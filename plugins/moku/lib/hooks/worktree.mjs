/**
 * A git worktree of a project on the rails is a lane of its own beside the main checkout.
 *
 * `.planning/` is gitignored, so git creates a worktree without it. The worktree gets a link to a folder
 * the main checkout keeps for it, `.planning/lanes/<name>/`, so its plan outlives the worktree. In that
 * folder the project's own files are links back to the main checkout, and everything else is the lane's:
 *
 * - shared by every checkout: the ledger, the project marker, decisions, steering, memory, the specs
 * - one per lane: `STATE.md`, `build/`, `changes/`, the brainstorm and context files, `e2e/`, `agents/`
 *
 * One `STATE.md` for every worktree is what made parallel work stall: a wave marked active in one worktree
 * stopped a commit and a turn in every other.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { isOnRails } from "../rails/ledger.mjs";

/** The folder of the main checkout's `.planning/` that holds one folder per worktree. */
export const LANES_DIR = "lanes";

/** What every checkout of a project shares. Files are linked even before they exist, folders once they do. */
const SHARED_FILES = ["state.json", "moku.md", "decisions.md", "steering.md", "memory.md", "learnings.md", "app-spec.md"];
const SHARED_FOLDERS = ["specs", "design", "memory"];

/** The file in a lane folder that names the worktree it belongs to. */
const OWNER_FILE = ".worktree";

/**
 * Give a git worktree its lane: link `.planning` to the lane folder in the main checkout, link the shared
 * files inside it, and keep the link out of git. Safe to call on every session start: it adds what is
 * missing and moves a worktree that still has the old link to the whole `.planning/` into a lane.
 * Does nothing outside git, in the main checkout, in a worktree that has a real `.planning/` of its own,
 * or when the main checkout is not on the rails.
 *
 * @param {string} cwd a directory inside the worktree
 * @returns {boolean} true when this call created or moved the link
 * @example
 * linkPlanning("/work/site/.claude/worktrees/fix-streak"); // true once, then false
 */
export function linkPlanning(cwd) {
  const top = git(cwd, "rev-parse", "--show-toplevel");
  if (!top) return false;

  // The first entry of `git worktree list` is the main checkout
  const main = git(cwd, "worktree", "list", "--porcelain")?.split("\n")[0].replace(/^worktree /, "");
  if (!main || main === top || !isOnRails(main)) return false;

  const link = join(top, ".planning");
  const shared = join(main, ".planning");
  const target = linkTarget(link);

  // A real folder is the worktree's own plan, and a link to somewhere else is somebody's choice
  if (present(link) && target === undefined) return false;
  if (target !== undefined && target !== shared && !target.startsWith(join(shared, LANES_DIR))) return false;

  const lane = target !== undefined && target !== shared ? target : laneFolder(shared, top);
  mkdirSync(lane, { recursive: true });
  writeFileSync(join(lane, OWNER_FILE), `${top}\n`);
  shareProjectFiles(shared, lane);
  allowPlanningDirectory(top, shared);

  // Already in its lane: only the shared links were brought up to date
  if (target === lane) return false;

  // Two SessionStart hooks link in parallel, and the one that loses finds the link already there
  try {
    if (target === shared) rmSync(link);
    symlinkSync(lane, link, "dir");
  } catch {
    return false;
  }

  // `.planning/` in .gitignore matches folders only, and git sees a link as a file
  if (!git(top, "check-ignore", ".planning")) excludeFromGit(top);

  return true;
}

/**
 * True when a checkout's `.planning` is the link `linkPlanning` makes: into the `.planning/` of a checkout
 * on the rails, or into a lane folder of it. A write through that link lands outside the worktree, where
 * Claude Code asks the person every time, so the write hook approves it.
 *
 * @param {string} root project root
 * @returns {boolean}
 * @example
 * isLaneLink("/work/site/.claude/worktrees/fix-streak"); // true
 */
export function isLaneLink(root) {
  const target = linkTarget(join(root, ".planning"));
  if (target === undefined) return false;

  // A lane folder is `.planning/lanes/<name>` of the main checkout
  const shared = basename(dirname(target)) === LANES_DIR ? dirname(dirname(target)) : target;

  return basename(shared) === ".planning" && isOnRails(dirname(shared));
}

/**
 * Where a lane's link to a shared file points, for a planning file of a worktree: `.planning/decisions.md`
 * in a lane is a link to the main checkout's `decisions.md`. Claude Code refuses to write a file that is a
 * link, and the worktree's isolation refuses the main checkout's path, so the write hook applies such a
 * write itself. Undefined for every other file, a lane's own files included.
 *
 * @param {string} root worktree root
 * @param {string} file path relative to the root
 * @returns {string | undefined} absolute path of the shared file in the main checkout
 * @example
 * sharedFileTarget("/work/site/.claude/worktrees/fix", ".planning/decisions.md"); // "/work/site/.planning/decisions.md"
 */
export function sharedFileTarget(root, file) {
  if (!file.startsWith(".planning/") || !isLaneLink(root)) return undefined;

  let entry;
  try {
    entry = join(realpathSync(dirname(join(root, file))), basename(file));
  } catch {
    return undefined;
  }

  const target = linkTarget(entry);
  if (target === undefined || !SHARED_FILES.includes(basename(file))) return undefined;

  return target.startsWith("/") ? target : join(dirname(entry), target);
}

/**
 * Apply a Write or an Edit to a shared planning file the way the tool would: Write replaces the content,
 * Edit replaces `old_string` once (or everywhere with `replace_all`) and fails when it is missing or not
 * unique.
 *
 * @param {string} target absolute path of the shared file
 * @param {string} tool "Write" or "Edit"
 * @param {Record<string, unknown>} input the tool's input
 * @returns {{ ok: boolean, message: string }}
 * @example
 * applySharedWrite("/work/site/.planning/decisions.md", "Edit", { old_string: "a", new_string: "b" }); // { ok: true, ... }
 */
export function applySharedWrite(target, tool, input) {
  if (tool === "Write") {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, String(input.content ?? ""));
    return { ok: true, message: `wrote ${target}` };
  }

  if (!existsSync(target)) return { ok: false, message: `${target} does not exist yet: create it with Write` };

  const text = readFileSync(target, "utf8");
  const before = String(input.old_string ?? "");
  const after = String(input.new_string ?? "");
  const count = before === "" ? 0 : text.split(before).length - 1;

  if (count === 0) return { ok: false, message: `old_string was not found in ${target}` };
  if (count > 1 && !input.replace_all) return { ok: false, message: `old_string is found ${count} times in ${target}: give more context or set replace_all` };

  writeFileSync(target, input.replace_all ? text.split(before).join(after) : text.replace(before, () => after));
  return { ok: true, message: `edited ${target}` };
}

/**
 * The lane folder of a worktree: named after the worktree, with a short hash when another worktree of the
 * same name already owns that folder.
 *
 * @param {string} shared the main checkout's `.planning/`
 * @param {string} top worktree root
 * @returns {string} absolute path of the lane folder
 */
function laneFolder(shared, top) {
  const plain = join(shared, LANES_DIR, basename(top).replace(/[^\w.-]/g, "_"));
  const owner = join(plain, OWNER_FILE);
  if (!existsSync(owner) || readFileSync(owner, "utf8").trim() === top) return plain;

  return `${plain}-${createHash("sha1").update(top).digest("hex").slice(0, 6)}`;
}

/**
 * Link the project's shared files into a lane folder. A file is linked before it exists, so the first
 * write to it lands in the main checkout. A folder is linked once the main checkout has it.
 *
 * @param {string} shared the main checkout's `.planning/`
 * @param {string} lane the lane folder
 */
function shareProjectFiles(shared, lane) {
  const names = [...SHARED_FILES, ...SHARED_FOLDERS.filter((name) => existsSync(join(shared, name)))];

  for (const name of names) {
    if (present(join(lane, name))) continue;

    try {
      symlinkSync(join(shared, name), join(lane, name));
    } catch {
      /* linked by a parallel hook */
    }
  }
}

/**
 * @param {string} path
 * @returns {string | undefined} where a link points, or undefined when the path is not a link
 */
function linkTarget(path) {
  try {
    return lstatSync(path).isSymbolicLink() ? readlinkSync(path) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Make the main checkout's `.planning/` a working directory of the worktree's sessions, in the worktree's
 * `.claude/settings.local.json`.
 *
 * A write through the lane link resolves outside the worktree. Claude Code's safety check asks the person
 * for every such write, in auto mode too, and an `allow` from a hook does not lift it. Inside an
 * additional directory the write is judged like any write in the project. Only that one folder is added;
 * every other rule of the file stays. A settings file that is not JSON, or one git tracks, is left alone.
 * Claude Code reads this file too late for the session that starts here; the entry that works at once is
 * the person's own, in `~/.claude/settings.json`, which `moku-rails allow-planning` offers. This stays as
 * the fallback for the sessions after.
 *
 * @param {string} top worktree root
 * @param {string} shared the main checkout's `.planning/`
 * @returns {boolean} true when the directory was added
 * @example
 * allowPlanningDirectory("/work/site/.claude/worktrees/fix-streak", "/work/site/.planning"); // true once
 */
export function allowPlanningDirectory(top, shared) {
  const name = join(".claude", "settings.local.json");
  if (git(top, "ls-files", "--error-unmatch", name) !== undefined) return false;

  const file = join(top, name);
  const dir = realpathSync(shared);
  let settings = {};
  try {
    settings = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  } catch {
    return false;
  }

  const dirs = Array.isArray(settings.permissions?.additionalDirectories) ? settings.permissions.additionalDirectories : [];
  if (dirs.includes(dir)) return false;

  settings.permissions = { ...settings.permissions, additionalDirectories: [...dirs, dir] };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);

  // The file is the worktree's own and never belongs in a commit
  if (git(top, "check-ignore", "-q", name) === undefined) excludeFromGit(top, name);

  return true;
}

/**
 * Add a path to the repository's `info/exclude`, which every worktree of it shares.
 *
 * @param {string} top worktree root
 * @param {string} [entry] the path to keep out of git
 */
function excludeFromGit(top, entry = ".planning") {
  const common = git(top, "rev-parse", "--path-format=absolute", "--git-common-dir");
  if (!common) return;

  mkdirSync(join(common, "info"), { recursive: true });
  appendFileSync(join(common, "info", "exclude"), `\n${entry}\n`);
}

/**
 * True for a file, a folder or a link, also a broken one.
 *
 * @param {string} path
 * @returns {boolean}
 */
function present(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The trimmed output of a git command, or undefined when it fails.
 *
 * @param {string} cwd
 * @param {...string} args
 * @returns {string | undefined}
 */
function git(cwd, ...args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}
