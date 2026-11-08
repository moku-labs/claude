/**
 * The project's `.planning/` as a working directory of every session, in the person's own
 * `~/.claude/settings.json`.
 *
 * A lane's `.planning` is a link into the main checkout. Claude Code asks the person for every write that
 * lands through it, in auto mode too, unless the target is inside `permissions.additionalDirectories`, and
 * only a list that is there when the session starts lifts it. The worktree's `settings.local.json`, written
 * by the SessionStart hook, comes too late; the user settings are read on the fly. The agent may not edit
 * the person's settings, so the rails offer the line once per project and the person runs it.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

/** Written into the main checkout's `.planning/` once the offer was shown; `.planning/` is never committed. */
export const OFFERED_FILE = ".planning-access-offered";

/** The command a person runs, as the rails print it. */
export const APPLY_ARGS = "allow-planning --apply";

/**
 * @typedef {{ dir: string, file: string, allowed: boolean, offered: boolean }} Access
 */

/**
 * The person's user settings file: `$CLAUDE_CONFIG_DIR/settings.json`, else `~/.claude/settings.json`.
 * Tests pass the file in.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function userSettingsFile(env = process.env) {
  return join(env.CLAUDE_CONFIG_DIR || join(env.HOME || homedir(), ".claude"), "settings.json");
}

/**
 * The `.planning/` every checkout of the project shares: the main checkout's, real path, links resolved.
 *
 * @param {string} root a checkout of the project, a worktree included
 * @returns {string}
 * @example
 * sharedPlanningDir("/work/site/.claude/worktrees/fix-streak"); // "/work/site/.planning"
 */
export function sharedPlanningDir(root) {
  const main = mainCheckout(root) ?? root;
  const dir = join(main, ".planning");
  try {
    return realpathSync(dir);
  } catch {
    return resolve(dir);
  }
}

/**
 * Where the project stands: the folder, whether the user settings already allow it, whether it was offered.
 * A missing or broken settings file counts as "not allowed"; it is only read.
 *
 * @param {string} root
 * @param {string} [file] user settings file
 * @returns {Access}
 */
export function planningAccess(root, file = userSettingsFile()) {
  const dir = sharedPlanningDir(root);
  const dirs = readSettings(file)?.permissions?.additionalDirectories;
  const allowed = Array.isArray(dirs) && dirs.some((entry) => typeof entry === "string" && covers(entry, dir));

  return { dir, file, allowed, offered: existsSync(join(dir, OFFERED_FILE)) };
}

/**
 * The once-per-project offer, for `session start`, `adopt` and `init done`. Silent when the folder is
 * already allowed or was offered before; otherwise the offer lines, and the offer is remembered.
 *
 * @param {string} root
 * @param {string} command how the person runs this CLI, the absolute path of moku-rails
 * @param {string} [file] user settings file
 * @returns {{ lines: string[], data: Access & { command: string } }}
 */
export function offerOnce(root, command, file = userSettingsFile()) {
  const access = planningAccess(root, file);
  const apply = applyCommand(command, root);
  if (access.allowed || access.offered) return { lines: [], data: { ...access, command: apply } };

  // Remember the offer only where .planning/ exists: a folder the rails did not make is not written into
  if (existsSync(access.dir)) writeFileSync(join(access.dir, OFFERED_FILE), `${new Date().toISOString()}\n`);

  return { lines: offerLines(access, apply), data: { ...access, offered: true, command: apply } };
}

/**
 * The offer, in words the agent passes to the person as they are.
 *
 * @param {Access} access
 * @param {string} apply
 * @returns {string[]}
 */
export function offerLines(access, apply) {
  return [
    `Offer (once per project): worktree sessions ask the person for every write into ${access.dir}. To stop that, the person adds it to permissions.additionalDirectories of ${access.file}. Only the person may edit that file: give them this line to type into the prompt, and never run it yourself:`,
    `  ! ${apply}`,
    `It adds that one folder, keeps every other setting, and takes effect at once. Or by hand: "permissions": { "additionalDirectories": ["${access.dir}"] }.`,
  ];
}

/**
 * Add the folder to the user settings, keeping every other key. Refuses a settings file that is not JSON
 * rather than overwrite it.
 *
 * @param {string} root
 * @param {string} [file]
 * @returns {{ changed: boolean, dir: string, file: string, error?: string }}
 */
export function applyAccess(root, file = userSettingsFile()) {
  const dir = sharedPlanningDir(root);
  const settings = existsSync(file) ? readSettings(file) : {};
  if (settings === undefined) return { changed: false, dir, file, error: `${file} is not valid JSON; it was left as it is. Fix it, or add the folder by hand.` };

  const dirs = Array.isArray(settings.permissions?.additionalDirectories) ? settings.permissions.additionalDirectories : [];
  if (dirs.some((entry) => typeof entry === "string" && covers(entry, dir))) return { changed: false, dir, file };

  settings.permissions = { ...settings.permissions, additionalDirectories: [...dirs, dir] };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);

  return { changed: true, dir, file };
}

/**
 * True when the shell command is the agent running the apply step, which only the person may run. The
 * person's `!` commands never reach the Bash hook, so this refuses the agent and nothing else.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isApplyCommand(command) {
  return /moku-rails\S*\s+allow-planning\b[^\n;&|]*--apply\b/.test(command);
}

/**
 * The exact line the person runs: this CLI by absolute path, so it does not depend on their PATH.
 *
 * @param {string} command absolute path of moku-rails
 * @param {string} root
 * @returns {string}
 */
export function applyCommand(command, root) {
  return `${quote(command)} ${APPLY_ARGS} --root ${quote(root)}`;
}

/** @param {string} value @returns {string} */
function quote(value) {
  return /^[\w./-]+$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

/**
 * An additional directory covers its own subtree. `~/` is the home folder, as Claude Code reads it.
 *
 * @param {string} entry
 * @param {string} dir
 * @returns {boolean}
 */
function covers(entry, dir) {
  const expanded = entry.replace(/^~(?=\/|$)/, homedir());
  let path = resolve(expanded);
  try {
    path = realpathSync(path);
  } catch {
    // a folder that does not exist yet is compared as written
  }

  return dir === path || dir.startsWith(path.endsWith(sep) ? path : path + sep);
}

/**
 * @param {string} file
 * @returns {any} the parsed object, undefined when missing or not a JSON object
 */
function readSettings(file) {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The main checkout of a git repository: the first entry of `git worktree list`.
 *
 * @param {string} root
 * @returns {string | undefined}
 */
function mainCheckout(root) {
  try {
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n")[0].replace(/^worktree /, "") || undefined;
  } catch {
    return undefined;
  }
}
