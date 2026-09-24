/**
 * A git worktree of a project on the rails works on the main checkout's plan.
 *
 * `.planning/` is gitignored, so git creates a worktree without it. A copy would drift from the main
 * checkout and be deleted with the worktree, so the worktree gets a link to the one `.planning/` instead.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { isOnRails } from "../rails/ledger.mjs";

/**
 * Link `.planning` in a git worktree to the main checkout's `.planning/`, and keep the link out of git.
 * Does nothing outside git, in the main checkout, in a worktree that has its own `.planning`, or when the
 * main checkout is not on the rails.
 *
 * @param {string} cwd a directory inside the worktree
 * @returns {boolean} true when this call created the link
 * @example
 * linkPlanning("/work/site/.claude/worktrees/fix-streak"); // true once, then false
 */
export function linkPlanning(cwd) {
  const top = git(cwd, "rev-parse", "--show-toplevel");
  if (!top || present(join(top, ".planning"))) return false;

  // The first entry of `git worktree list` is the main checkout
  const main = git(cwd, "worktree", "list", "--porcelain")?.split("\n")[0].replace(/^worktree /, "");
  if (!main || main === top || !isOnRails(main)) return false;

  // Two SessionStart hooks link in parallel, and the one that loses finds the link already there
  try {
    symlinkSync(join(main, ".planning"), join(top, ".planning"), "dir");
  } catch {
    return false;
  }

  // `.planning/` in .gitignore matches folders only, and git sees a link as a file
  if (!git(top, "check-ignore", ".planning")) excludeFromGit(top);

  return true;
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
