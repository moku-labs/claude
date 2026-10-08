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
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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
 * Add `.planning` to the repository's `info/exclude`, which every worktree of it shares.
 *
 * @param {string} top worktree root
 */
function excludeFromGit(top) {
  const common = git(top, "rev-parse", "--path-format=absolute", "--git-common-dir");
  if (!common) return;

  mkdirSync(join(common, "info"), { recursive: true });
  appendFileSync(join(common, "info", "exclude"), "\n.planning\n");
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
