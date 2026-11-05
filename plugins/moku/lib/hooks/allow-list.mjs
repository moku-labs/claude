#!/usr/bin/env node
/**
 * The commands a moku session runs all the time, allowed in the project's `.claude/settings.local.json`
 * so the person is not asked for each `moku-rails status`, `moku-rails continue` or `git diff`.
 *
 * Two lists. The read-only one holds only commands that cannot write: no `cat`, `find`, `sed` or
 * interpreter, whose arguments can write files. The rails one holds the ledger moves and edits of
 * `.planning/`, the rails' own state. Nothing that pushes, deletes, installs or reaches the network.
 *
 * The init station writes them with the rest of its allow-list (`tooling-config.md`); the session skill
 * merges them into a project that was never initialized by init. Run as a script:
 * `node allow-list.mjs --root <project>`. Existing rules stay; nothing is removed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The read-only allow rules. */
export const READ_ONLY_ALLOW = [
  "Bash(moku-rails status:*)",
  "Bash(moku-rails waves:*)",
  "Bash(moku-rails tests:*)",
  "Bash(git status:*)",
  "Bash(git log:*)",
  "Bash(git diff:*)",
  "Bash(git show:*)",
  "Bash(git branch --show-current)",
  "Bash(git rev-parse:*)",
  "Bash(git worktree list:*)",
  "Bash(pwd)",
  "Bash(ls:*)",
  "Bash(tree:*)",
  "Bash(wc:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
];

/**
 * The rails' own moves and the plan files. Each `moku-rails` command here changes only the ledger,
 * `.planning/state.json`; the edit rule covers `.planning/` and nothing else, and the write hook still
 * guards every file. Not here: `check` runs the project's tests, `session`, `init` and `adopt` create
 * folders and files wherever `--root` points.
 */
export const RAILS_ALLOW = [
  "Bash(moku-rails open:*)",
  "Bash(moku-rails enter:*)",
  "Bash(moku-rails done:*)",
  "Bash(moku-rails skip:*)",
  "Bash(moku-rails close:*)",
  "Bash(moku-rails pause:*)",
  "Bash(moku-rails park:*)",
  "Bash(moku-rails resume:*)",
  "Bash(moku-rails continue:*)",
  "Bash(moku-rails scope:*)",
  "Bash(moku-rails idea:*)",
  "Bash(moku-rails tier:*)",
  "Bash(moku-rails guard:*)",
  "Bash(moku-rails guard-bash:*)",
  "Bash(moku-rails may-stop:*)",
  "Edit(/.planning/**)",
];

/**
 * Merge the read-only rules and the rails rules into `.claude/settings.local.json` of a project.
 *
 * @param {string} root project root
 * @returns {string[]} the rules that were added; empty when every one was there
 * @example
 * allowReadOnly("/work/site"); // ["Bash(moku-rails status:*)", ...]
 */
export function allowReadOnly(root) {
  const file = join(root, ".claude", "settings.local.json");
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const allow = Array.isArray(settings.permissions?.allow) ? settings.permissions.allow : [];
  const added = [...READ_ONLY_ALLOW, ...RAILS_ALLOW].filter((rule) => !allow.includes(rule));
  if (added.length === 0) return [];

  settings.permissions = { ...settings.permissions, allow: [...allow, ...added] };
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);

  return added;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--root");
  const root = resolve(at === -1 ? process.cwd() : process.argv[at + 1]);

  try {
    const added = allowReadOnly(root);
    console.log(added.length === 0 ? "Rails and read-only commands: already allowed." : `Rails and read-only commands: ${added.length} rule(s) added to .claude/settings.local.json.`);
  } catch (error) {
    // A settings file that is not JSON is the person's: it is left alone, and the session goes on
    console.log(`Rails and read-only commands: not added, .claude/settings.local.json could not be read (${error.message}).`);
  }
}
