/**
 * Worktrees of a resumed session: give a saved session its folder back before the app opens it, free its branch
 * when the app will check it out elsewhere, and carry the files it had not committed to the folder it opened in.
 *
 * One concern: the git side of a resume. Nothing here deletes a file, a branch or a worktree: a folder that is gone
 * is added again from its branch, a branch held by the session's own old folder is released with a detached HEAD
 * (the files stay), and files are copied only where the target has none or has the committed version.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * @typedef {object} Prepared
 * @property {"ready" | "recreated" | "released" | "lost" | "blocked"} state what was done to the folder
 * @property {string} line one line for the person, empty when the folder needed nothing
 */

/**
 * Run git and return its output, or undefined when it failed.
 *
 * @param {string[]} args
 * @returns {string | undefined}
 */
function git(args) {
  const run = spawnSync("git", args, { encoding: "utf8" });
  return run.status === 0 ? run.stdout : undefined;
}

/**
 * Whether a branch exists in the repository.
 *
 * @param {string} repo any folder of the repository
 * @param {string} branch
 * @returns {boolean}
 * @example
 * branchExists("/work/game", "claude/event-cards"); // true
 */
export function branchExists(repo, branch) {
  return Boolean(branch) && existsSync(repo) && git(["-C", repo, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]) !== undefined;
}

/**
 * The folder of the main checkout of the repository a folder belongs to, or undefined outside git.
 *
 * @param {string} dir
 * @returns {string | undefined}
 */
export function mainCheckout(dir) {
  const common = git(["-C", dir, "rev-parse", "--path-format=absolute", "--git-common-dir"])?.trim();
  return common ? dirname(common) : undefined;
}

/**
 * The worktree that has a branch checked out, with whether its folder still exists.
 *
 * @param {string} repo
 * @param {string} branch
 * @returns {{ path: string, exists: boolean } | undefined}
 */
export function worktreeOf(repo, branch) {
  const list = git(["-C", repo, "worktree", "list", "--porcelain"]);
  if (!list) return undefined;

  for (const block of list.split("\n\n")) {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    const head = /^branch (.+)$/m.exec(block)?.[1];
    if (path && head === `refs/heads/${branch}`) return { path, exists: existsSync(path) };
  }

  return undefined;
}

/**
 * Give a saved session the folder the app opens it in. A folder that is gone is added again from its branch at the
 * old path; a branch that is gone too is reported as lost. When the app will make a worktree of its own for the
 * session (`releaseBranch`, a worktree the app made), the branch must be free: the old folder gets a detached HEAD
 * on the same commit, so every file in it stays as it is.
 *
 * @param {{ cwd: string, repo?: string | null, branch?: string, releaseBranch?: boolean }} session
 * @returns {Prepared}
 * @example
 * prepareFolder({ cwd: "/work/game/.claude/worktrees/cards", repo: "/work/game", branch: "claude/cards" });
 * // { state: "recreated", line: "Added the worktree /work/game/.claude/worktrees/cards again from claude/cards." }
 */
export function prepareFolder({ cwd, repo, branch = "", releaseBranch = false }) {
  if (!existsSync(cwd)) return recreate(cwd, repo ?? undefined, branch, releaseBranch);
  if (!releaseBranch || !branch) return { state: "ready", line: "" };

  const holder = worktreeOf(cwd, branch);
  if (!holder) return { state: "ready", line: "" };
  if (!samePath(holder.path, cwd)) return { state: "blocked", line: `${branch} is checked out in ${holder.path}, another folder than the session's: the app cannot open the session on it until that folder switches to another branch.` };

  // The session's own old folder holds the branch the app is about to check out in a new worktree
  if (git(["-C", cwd, "switch", "--quiet", "--detach"]) === undefined) return { state: "blocked", line: `Could not release ${branch} in ${cwd}: run \`git -C '${cwd}' switch --detach\`, then open the session.` };
  return { state: "released", line: `Released ${branch} from ${cwd} (detached HEAD on the same commit, every file kept), so the app can check it out.` };
}

/**
 * Add a gone worktree again at its old path.
 *
 * @param {string} cwd
 * @param {string | undefined} repo
 * @param {string} branch
 * @param {boolean} detached whether the app takes the branch itself
 * @returns {Prepared}
 */
function recreate(cwd, repo, branch, detached) {
  if (!repo || !existsSync(repo)) return { state: "lost", line: `Lost: the folder ${cwd} and its repository ${repo ?? "(unknown)"} are gone. The conversation stays in its transcript.` };
  if (!branchExists(repo, branch)) return { state: "lost", line: `Lost: the folder ${cwd} is gone and its branch ${branch || "(none)"} no longer exists in ${repo}. The conversation stays in its transcript; the uncommitted files of that folder are gone.` };

  // A registration left behind by the removed folder is only git's bookkeeping: the folder itself is already gone
  const holder = worktreeOf(repo, branch);
  if (holder && !holder.exists) git(["-C", repo, "worktree", "prune"]);
  else if (holder && !detached) return { state: "blocked", line: `The folder ${cwd} is gone and ${branch} is checked out in ${holder.path}: open the session from there, or free the branch first.` };

  mkdirSync(dirname(cwd), { recursive: true });
  const added = git(["-C", repo, "worktree", "add", "--quiet", ...(detached ? ["--detach", cwd, branch] : [cwd, branch])]);
  if (added === undefined) return { state: "blocked", line: `Could not add the worktree ${cwd} from ${branch} again: run \`git -C '${repo}' worktree add '${cwd}' ${branch}\`.` };
  return { state: "recreated", line: `Added the worktree ${cwd} again from ${branch}${detached ? " (detached, the app checks the branch out itself)" : ""}.` };
}

/**
 * The changed and new files of a folder, as paths relative to it. Deleted files are left out: a deletion is never
 * carried.
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function changedFiles(dir) {
  const out = git(["-C", dir, "status", "--porcelain=v1", "--untracked-files=all"]);
  if (out === undefined) return [];

  return out
    .split("\n")
    .filter((line) => line.length > 3 && !line.slice(0, 2).includes("D"))
    .map((line) => line.slice(3).replace(/^.* -> /, "").replace(/^"(.*)"$/, "$1"));
}

/**
 * Copy the files a session had not committed from its old folder to the folder the app opened it in. A file is
 * copied when the target has none, or has the committed version of it; a target file that changed is left as it is
 * and named. Nothing is deleted or moved: the old folder keeps its copy.
 *
 * @param {string} from the old folder
 * @param {string} to the folder the session works in now
 * @returns {{ copied: string[], kept: string[] }} the files copied, and the ones left because the target changed
 * @example
 * carryFiles("/work/game/.claude/worktrees/old", "/work/game/.claude/worktrees/new"); // { copied: ["perf/run.json"], kept: [] }
 */
export function carryFiles(from, to) {
  const copied = [];
  const kept = [];
  if (!existsSync(from) || !existsSync(to) || samePath(from, to)) return { copied, kept };

  const changedThere = new Set(changedFiles(to));
  for (const file of changedFiles(from)) {
    const source = join(from, file);
    const target = join(to, file);
    if (!existsSync(source) || !statSync(source).isFile()) continue;
    if (existsSync(target) && readFileSync(target).equals(readFileSync(source))) continue;
    if (existsSync(target) && changedThere.has(file)) {
      kept.push(file);
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied.push(file);
  }

  return { copied, kept };
}

/**
 * Whether two paths name the same folder, through symlinks such as macOS's `/var` → `/private/var`.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function samePath(a, b) {
  const real = (/** @type {string} */ path) => (existsSync(path) ? realpathSync(path) : resolve(path));
  return real(a) === real(b);
}
