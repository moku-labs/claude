/**
 * What the project's pre-commit hook proves about the tests.
 *
 * One concern: read the hook configuration (lefthook, husky, simple-git-hooks) far enough to name the
 * test commands that run on every commit, and decide whether a commit that went through proves the
 * project's whole `test` script green. A job that is conditional, a file that cannot be read and a hook
 * that left no trace in the commit's output prove nothing.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { cleanHead, headCommit } from "./reconcile.mjs";
import { shellCommands } from "./shell.mjs";
import { outcomeOf, parseTestOutput, withoutColour } from "./test-output.mjs";
import { fullKey, testCommand } from "./test-runs.mjs";

/**
 * @typedef {object} HookTest
 * @property {string} job the hook job the command runs in
 * @property {string} command the test command as the hook writes it
 * @property {string} key what the runner is started with, as in the test-run log
 */

/**
 * @typedef {object} CommitHook
 * @property {"lefthook" | "husky" | "simple-git-hooks"} manager
 * @property {HookTest[]} tests the test commands that run on every commit, with no condition
 * @property {boolean} full true when together they are the project's whole `test` script
 * @property {string} [doubt] why a commit proves nothing in this checkout although the hook is configured
 */

/** @typedef {{ name: string, run: string }} Job a hook job that runs on every commit */
/** @typedef {{ manager: CommitHook["manager"], jobs: Job[], doubt?: string }} HookConfig */
/** @typedef {{ key: string, value: string, body: string[] }} Entry one `key: value` of a YAML mapping, with the lines under it */

/**
 * @typedef {object} CommitProof
 * @property {string} head the commit the hook let through
 * @property {HookTest[]} tests what the hook ran
 * @property {boolean} full true when that was the project's whole `test` script
 * @property {number} [ms] how long the hook's test jobs took, when the hook printed it
 */

const LEFTHOOK_FILES = ["lefthook.yml", "lefthook.yaml", ".lefthook.yml", ".lefthook.yaml"];
const LEFTHOOK_OVERRIDES = ["lefthook-local.yml", "lefthook-local.yaml", ".lefthook-local.yml", ".lefthook-local.yaml"];
const VITEST_CONFIGS = ["vitest.config.ts", "vitest.config.mts", "vitest.config.js", "vitest.config.mjs"];
const VITEST_WORKSPACES = ["vitest.workspace.ts", "vitest.workspace.js", "vitest.workspace.mjs", "vitest.workspace.json"];

/** Job keys that make a job run only for some commits. */
const CONDITIONS = new Set(["glob", "files", "exclude", "file_types", "skip", "only", "tags", "root", "group"]);

/** The one skip condition the rails can check: the scaffold's `skip: - run: test ! -d node_modules`. */
const SKIP_WITHOUT_MODULES = "test ! -d node_modules";

const TEMPLATE = /\{(?:staged_files|push_files|all_files|files|cmd|\d+)\}/;
const SHELL_CONTROL = /^(?:if|then|else|elif|fi|for|while|until|case|esac|do|done|exit|return)\b|\|\|/;
const HUSKY_SETUP = /^(?:#|\.\s|source\s)/;
const PROJECT_FLAG = /\s--project[= ]([\w-]+)/g;
const PROJECTS_ARRAY = /\bprojects\s*:\s*\[/;
const PROJECT_NAME = /\bname\s*:\s*["'`]([\w-]+)["'`]/;
const ASSIGNMENT = /^\w+=/;
const HOOK_SWITCH = /^(?:LEFTHOOK|HUSKY|SKIP_SIMPLE_GIT_HOOKS)/;
const SKIPS_HOOKS = /^(?:--no-verify|-[a-zA-Z]*n[a-zA-Z]*)$/;

/** What may stand beside `git commit` on the line: staging, reading, and filters of the output. */
const PLAIN_GIT = new Set(["add", "commit", "status", "log", "diff", "show"]);
const FILTERS = new Set(["tail", "head", "grep", "cat", "cd"]);

/**
 * The pre-commit hook of a project, read from its configuration. Undefined when the project has none.
 *
 * @param {string} root project root
 * @returns {CommitHook | undefined}
 * @example
 * commitHook(root); // { manager: "lefthook", tests: [{ job: "test", command: "bun run test", key: "vitest run" }], full: true }
 */
export function commitHook(root) {
  const config = readLefthook(root) ?? readHusky(root) ?? readSimpleGitHooks(root);
  if (!config) return undefined;

  const tests = config.jobs.flatMap((job) => testsOfJob(job, root));
  const doubt = config.doubt ?? (isInstalled(root) ? undefined : "the hook is configured but not installed in this checkout");

  return { manager: config.manager, tests, full: coversFullScript(tests.map((test) => test.key), root), ...(doubt ? { doubt } : {}) };
}

/**
 * What a `git commit` that just ran proves. Every link must hold: the line is a plain commit that did
 * not switch the hook off, the hook runs tests on every commit with no doubt, HEAD moved to a commit with
 * nothing left uncommitted, and the commit's output shows the hook's test jobs passing.
 *
 * @param {{ root: string, line: string, before: string | undefined, output: string, environment?: NodeJS.ProcessEnv }} facts `before`: HEAD when the command started
 * @returns {CommitProof | undefined}
 * @example
 * commitProof({ root, line: 'git commit -m "fix"', before: "3f2a9c1", output })?.full; // true
 */
export function commitProof({ root, line, before, output, environment = process.env }) {
  if (!isHookedCommit(line, environment)) return undefined;

  const hook = commitHook(root);
  if (!hook || hook.doubt || hook.tests.length === 0) return undefined;

  // The hook tested the files on disk: they are the commit only when nothing else is left uncommitted
  const head = headCommit(root);
  if (!head || head === before || cleanHead(root) !== head) return undefined;

  const evidence = hookEvidence(hook, output);
  if (!evidence) return undefined;

  return { head, tests: hook.tests, full: hook.full, ...evidence };
}

/**
 * True for a line that makes one commit through the hook: `git commit` beside staging, reading and
 * output filters only, with no `--no-verify` and no variable that switches a hook manager off.
 *
 * @param {string} line a shell command line
 * @param {NodeJS.ProcessEnv} environment
 * @returns {boolean}
 * @example
 * isHookedCommit('git add -A && git commit -m "fix" 2>&1 | tail -5', {}); // true
 * isHookedCommit('git commit --no-verify -m "wip"', {}); // false
 */
export function isHookedCommit(line, environment) {
  if (Object.keys(environment).some((name) => HOOK_SWITCH.test(name))) return false;

  let commits = 0;
  for (const { words } of shellCommands(line)) {
    if (words.some((word) => ASSIGNMENT.test(word) && HOOK_SWITCH.test(word))) return false;

    const [name, verb, ...rest] = words.filter((word) => !ASSIGNMENT.test(word));
    if (FILTERS.has(name)) continue;
    if (name !== "git" || !PLAIN_GIT.has(verb)) return false;

    if (verb !== "commit") continue;
    if (rest.some((word) => SKIPS_HOOKS.test(word))) return false;
    commits += 1;
  }

  return commits === 1;
}

/**
 * The test commands of one job. A job counts only when it is commands joined by `&&`: then it passes
 * only when each of them did.
 *
 * @param {Job} job
 * @param {string} root
 * @returns {HookTest[]}
 */
function testsOfJob(job, root) {
  if (!testCommand(job.run, root)?.exitKnown) return [];

  return job.run.split("&&").flatMap((part) => {
    const test = testCommand(part, root);
    return test ? [{ job: job.name, command: test.command, key: test.key }] : [];
  });
}

/**
 * True when the hook's commands are the project's whole `test` script: one of them is the script, they
 * are its `&&` parts, or they run every project the script runs, one `--project` at a time.
 *
 * @param {string[]} keys
 * @param {string} root
 * @returns {boolean}
 */
function coversFullScript(keys, root) {
  const full = fullKey(root);
  if (!full) return false;
  if (keys.includes(full) || full.split(" && ").every((part) => keys.includes(part))) return true;

  // `vitest run --project unit` and `vitest run --project integration` against `vitest run`
  const base = full.replace(PROJECT_FLAG, "");
  const covered = new Set(keys.filter((key) => key !== key.replace(PROJECT_FLAG, "") && key.replace(PROJECT_FLAG, "") === base).flatMap((key) => projectsIn(key)));
  const wanted = projectsIn(full).length > 0 ? projectsIn(full) : base.startsWith("vitest") ? vitestProjects(root) : undefined;

  return wanted !== undefined && wanted.length > 0 && wanted.every((name) => covered.has(name));
}

/**
 * @param {string} key
 * @returns {string[]} the projects a command names with `--project`
 */
function projectsIn(key) {
  return [...key.matchAll(PROJECT_FLAG)].map((match) => match[1]);
}

/**
 * The project names of the Vitest configuration, when every project is an object written in the file
 * with a literal `name`. A workspace file, a glob, an imported project or a computed name is unknown.
 *
 * @param {string} root
 * @returns {string[] | undefined}
 * @example
 * vitestProjects(root); // ["unit", "integration"]
 */
function vitestProjects(root) {
  const file = VITEST_CONFIGS.map((name) => join(root, name)).find((path) => existsSync(path));
  if (!file || VITEST_WORKSPACES.some((name) => existsSync(join(root, name)))) return undefined;

  const source = readFileSync(file, "utf8");
  const start = PROJECTS_ARRAY.exec(source);
  const items = start ? arrayItems(source, start.index + start[0].length) : undefined;
  if (!items || items.length === 0) return undefined;

  const names = items.map((item) => (item.startsWith("{") ? PROJECT_NAME.exec(item)?.[1] : undefined));

  return names.every((name) => name !== undefined) ? /** @type {string[]} */ (names) : undefined;
}

/**
 * The elements of an array literal in source text, read from just behind its `[`. Strings and comments
 * are skipped, nested brackets are kept inside their element.
 *
 * @param {string} source
 * @param {number} from index of the first character behind `[`
 * @returns {string[] | undefined} undefined when the array never closes
 * @example
 * arrayItems('[{ name: "a" }, { name: "b" }]', 1); // ['{ name: "a" }', '{ name: "b" }']
 */
function arrayItems(source, from) {
  /** @type {string[]} */
  const items = [];
  let item = "";
  let depth = 0;
  let quote = "";

  for (let index = from; index < source.length; index += 1) {
    const char = source[index];

    // Inside a string every character is data
    if (quote) {
      item += char;
      if (char === "\\") item += source[(index += 1)] ?? "";
      else if (char === quote) quote = "";
      continue;
    }

    // A comment ends at its line or at its closing mark
    if (char === "/" && source[index + 1] === "/") index = endOf(source, "\n", index);
    else if (char === "/" && source[index + 1] === "*") index = endOf(source, "*/", index) + 1;
    else if (char === "]" && depth === 0) return [...items, item].map((text) => text.trim()).filter((text) => text !== "");
    else if (char === "," && depth === 0) {
      items.push(item);
      item = "";
    } else {
      if (char === '"' || char === "'" || char === "`") quote = char;
      if ("([{".includes(char)) depth += 1;
      if (")]}".includes(char)) depth -= 1;
      item += char;
    }
  }

  return undefined;
}

/**
 * @param {string} source
 * @param {string} mark
 * @param {number} from
 * @returns {number} the index of `mark` behind `from`, or the last index when it never comes
 */
function endOf(source, mark, from) {
  const at = source.indexOf(mark, from);

  return at === -1 ? source.length - 1 : at;
}

/**
 * The trace a passed hook leaves in the commit's output. lefthook closes with one line per job, a check
 * mark and the job's seconds. The other managers print nothing of their own, so the runner's totals count.
 *
 * @param {CommitHook} hook
 * @param {string} output what the commit printed
 * @returns {{ ms?: number } | undefined} undefined when the output does not show the tests passing
 */
function hookEvidence(hook, output) {
  const plain = withoutColour(output);

  // No summary of the manager's own: the runner's totals are the trace, and its duration the time
  if (hook.manager !== "lefthook") {
    const totals = parseTestOutput(plain);
    if (outcomeOf(totals) !== "green") return undefined;

    return totals?.ms === undefined ? {} : { ms: totals.ms };
  }

  const jobs = [...new Set(hook.tests.map((test) => test.job))];
  const seconds = jobs.map((job) => new RegExp(`^\\s*✔\\uFE0F?\\s*${job.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\(([\\d.]+) seconds?\\)`, "m").exec(plain)?.[1]);
  if (seconds.some((value) => value === undefined)) return undefined;

  return { ms: Math.round(seconds.reduce((total, value) => total + Number(value), 0) * 1000) };
}

/**
 * lefthook: the `pre-commit` block of its configuration, as the jobs that run on every commit.
 *
 * @param {string} root
 * @returns {HookConfig | undefined}
 */
function readLefthook(root) {
  const file = LEFTHOOK_FILES.map((name) => join(root, name)).find((path) => existsSync(path));
  if (!file) return undefined;

  const source = readFileSync(file, "utf8");
  const block = mapping(source.split("\n")).find((entry) => entry.key === "pre-commit");
  if (!block) return undefined;

  const entries = mapping(block.body);
  const listed = sequence(entries.find((entry) => entry.key === "jobs")?.body ?? []).map((item) => mapping(item));
  const named = mapping(entries.find((entry) => entry.key === "commands")?.body ?? []).map((entry) => [{ key: "name", value: entry.key, body: [] }, ...mapping(entry.body)]);
  const jobs = [...listed, ...named].flatMap((properties) => jobOf(properties));

  return { manager: "lefthook", jobs, ...(lefthookDoubt(root, source, entries) ? { doubt: lefthookDoubt(root, source, entries) } : {}) };
}

/**
 * @param {Entry[]} properties the keys of one lefthook job
 * @returns {Job[]} the job, or nothing when it is conditional or runs no command line
 */
function jobOf(properties) {
  const run = properties.find((entry) => entry.key === "run");
  if (!run || properties.some((entry) => CONDITIONS.has(entry.key))) return [];

  const command = scalar(run);
  if (TEMPLATE.test(command)) return [];

  return [{ name: scalar(properties.find((entry) => entry.key === "name") ?? run), run: command }];
}

/**
 * Why a lefthook hook cannot be trusted here: another file changes it, or it has a condition the rails
 * cannot check. The scaffold's own condition is checked: the hook steps aside without `node_modules`.
 *
 * @param {string} root
 * @param {string} source the configuration file
 * @param {Entry[]} entries the keys of the `pre-commit` block
 * @returns {string | undefined}
 */
function lefthookDoubt(root, source, entries) {
  if (LEFTHOOK_OVERRIDES.some((name) => existsSync(join(root, name))) || /^(?:extends|remotes):/m.test(source)) return "another lefthook file changes the hook";

  const condition = entries.find((entry) => entry.key === "skip" || entry.key === "only");
  if (!condition) return undefined;

  const items = sequence(condition.body).map((item) => mapping(item));
  const known = condition.key === "skip" && items.length === 1 && items[0].length === 1 && items[0][0].key === "run" && scalar(items[0][0]) === SKIP_WITHOUT_MODULES;
  if (!known) return `the hook has a \`${condition.key}\` condition the rails cannot check`;

  return existsSync(join(root, "node_modules")) ? undefined : "the hook steps aside in a checkout without node_modules";
}

/**
 * husky: every command line of `.husky/pre-commit`. A script with conditions is not followed.
 *
 * @param {string} root
 * @returns {HookConfig | undefined}
 */
function readHusky(root) {
  const file = join(root, ".husky", "pre-commit");
  if (!existsSync(file)) return undefined;

  const lines = readFileSync(file, "utf8").split("\n").map((line) => line.trim()).filter((line) => line !== "" && !HUSKY_SETUP.test(line));
  if (lines.some((line) => SHELL_CONTROL.test(line))) return { manager: "husky", jobs: [], doubt: "the hook script has conditions the rails cannot follow" };

  return { manager: "husky", jobs: lines.map((line) => ({ name: "pre-commit", run: line })) };
}

/**
 * simple-git-hooks: the `pre-commit` command in `package.json`.
 *
 * @param {string} root
 * @returns {HookConfig | undefined}
 */
function readSimpleGitHooks(root) {
  try {
    const run = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))["simple-git-hooks"]?.["pre-commit"];

    return typeof run === "string" ? { manager: "simple-git-hooks", jobs: [{ name: "pre-commit", run }] } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} root
 * @returns {boolean} whether git has a `pre-commit` hook to run in this checkout
 */
function isInstalled(root) {
  try {
    const path = execFileSync("git", ["rev-parse", "--git-path", "hooks/pre-commit"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

    return existsSync(resolve(root, path));
  } catch {
    return false;
  }
}

/**
 * The keys of a YAML mapping at its own indent, each with the deeper lines under it. Enough YAML for a
 * hook configuration: block mappings, block lists and block scalars. Anchors and flow style are not read.
 *
 * @param {string[]} lines the lines of the mapping
 * @returns {Entry[]}
 * @example
 * mapping(["jobs:", "  - run: bun run test"]); // [{ key: "jobs", value: "", body: ["  - run: bun run test"] }]
 */
function mapping(lines) {
  const body = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  if (body.length === 0) return [];

  /** @type {Entry[]} */
  const entries = [];
  const indent = indentOf(body[0]);
  for (const line of body) {
    const own = indentOf(line) === indent ? /^\s*([\w-]+):(?:\s+(.*))?$/.exec(line) : null;
    if (own) entries.push({ key: own[1], value: own[2] ?? "", body: [] });
    else entries.at(-1)?.body.push(line);
  }

  return entries;
}

/**
 * The items of a YAML block list. Each item comes back as the lines of its own mapping.
 *
 * @param {string[]} lines the lines of the list
 * @returns {string[][]}
 * @example
 * sequence(["  - name: test", "    run: bun run test"]); // [["    name: test", "    run: bun run test"]]
 */
function sequence(lines) {
  const body = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  if (body.length === 0) return [];

  /** @type {string[][]} */
  const items = [];
  const indent = indentOf(body[0]);
  for (const line of body) {
    if (indentOf(line) === indent && line.trim().startsWith("-")) items.push([line.replace("-", " ")]);
    else items.at(-1)?.push(line);
  }

  return items;
}

/**
 * The value of an entry as text: a plain or quoted scalar, or a `|` or `>` block joined to one command.
 *
 * @param {Entry} entry
 * @returns {string}
 */
function scalar(entry) {
  const value = entry.value.trim();
  if (/^[|>][+-]?$/.test(value)) return entry.body.map((line) => line.trim()).join(value.startsWith("|") ? "\n" : " ");

  const quoted = /^(["'])(.*)\1\s*(?:#.*)?$/.exec(value);

  return quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
}

/**
 * @param {string} line
 * @returns {number} the count of leading spaces
 */
function indentOf(line) {
  return line.length - line.trimStart().length;
}
