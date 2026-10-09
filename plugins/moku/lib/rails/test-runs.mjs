/**
 * The test-run log: `.planning/tests/runs.jsonl`, one line per test run of this checkout.
 *
 * One concern: name a test command and the tree it runs on, append the run, and read the log back as
 * numbers. Who ran it makes no difference here: the rails' own check, an agent's shell, or the commit hook.
 * A git worktree keeps its own log, because its `.planning/` is its own lane folder.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";

import { shellCommands } from "./shell.mjs";

/** @typedef {import("./test-output.mjs").Timing} Timing */
/** @typedef {"green" | "red" | "unknown"} Outcome */

/**
 * @typedef {object} TestCommand
 * @property {string} command the test command as typed, without what surrounds it on the line
 * @property {string} key what the runner is started with: `bun run test` and the script it names share one key
 * @property {"full" | "subset"} scope full: the project's whole `test` script
 * @property {boolean} exitKnown true when the exit status of the whole line is the test's own
 */

/**
 * @typedef {object} TestRun
 * @property {string} at when the run started, ISO
 * @property {string} command
 * @property {string} key
 * @property {"full" | "subset"} scope
 * @property {string} [tree] the tree the run saw; absent when nothing names it or it changed during the run
 * @property {number} [ms] wall time
 * @property {Outcome} outcome unknown: the exit status was hidden by a filter and no totals were printed
 * @property {"rails" | "agent" | "hook"} by the rails' check, an agent's shell, or the commit hook
 * @property {string} [agent] the agent type, for a run from a subagent's shell
 * @property {Outcome} [repeats] set when the same command had already run on this tree: the outcome of that run
 * @property {number} [passed]
 * @property {number} [failed]
 * @property {Timing[]} [slowest]
 */

/**
 * @typedef {object} TestReport
 * @property {number} runs
 * @property {string} [since] when the first recorded run started
 * @property {Record<string, number>} by runs per source
 * @property {number} ms wall time of every timed run
 * @property {number} redundant runs that repeated a green result on an unchanged tree
 * @property {number} redundantMs
 * @property {number} repeats runs that repeated a red or unread run on an unchanged tree
 * @property {number} repeatsMs
 * @property {number} thresholdMs
 * @property {Timing[]} slow tests at or over the threshold, slowest first
 */

/** Tests at or over this many milliseconds are slow, unless the project sets `slowTestMs`. */
export const SLOW_TEST_MS = 1000;

const TESTS_DIR = join(".planning", "tests");
const RUNS_FILE = join(TESTS_DIR, "runs.jsonl");
const OUTPUT_FILE = join(TESTS_DIR, "last.log");
const PENDING_DIR = join(TESTS_DIR, "pending");
const SETTINGS_FILE = join(".claude", "moku.local.md");

/** A started run that never reported back is forgotten after this long. */
const PENDING_STALE_MS = 60 * 60 * 1000;

/** The slow list reads this many of the latest runs, and prints this many tests. */
const RECENT_RUNS = 500;
const SLOW_LISTED = 10;

/** How deep a script that calls another script is followed. */
const SCRIPT_DEPTH = 3;

const ASSIGNMENT = /^\w+=/;
const TEST_SCRIPT = /^(?:test|e2e|coverage)(?:[:.-]|$)/;
const SLOW_SETTING = /^slowTestMs:\s*(\d+)\s*$/m;

/** Arguments that only narrow a run: paths, `--project <name>`, `-t <name>`. */
const NARROWING = /^(?:\s+(?:--project(?:=|\s+)[\w-]+|(?:-t|--testNamePattern)\s+\S+|[^-\s]\S*))+$/;

const WRAPPERS = new Set(["time", "npx", "bunx", "pnpx", "command", "exec"]);
const MANAGERS = new Set(["bun", "npm", "pnpm", "yarn"]);
const RUNNERS = new Set(["vitest", "playwright", "jest"]);

/**
 * The test command inside a shell line, or undefined when the line runs no tests. A script is named by
 * what it starts, read from `package.json`, so `bun run test`, `node --run test` and the runner typed
 * by hand are one command. A watch mode is not a run.
 *
 * @param {string} line a shell command line
 * @param {string} root project root
 * @returns {TestCommand | undefined}
 * @example
 * testCommand("cd app && bun run test 2>&1 | tail -5", root);
 * // { command: "bun run test", key: "vitest run", scope: "full", exitKnown: false }
 */
export function testCommand(line, root) {
  const scripts = readScripts(root);
  const tests = shellCommands(line).map((segment) => invoked(segment.words)).filter((words) => isTest(words));
  if (tests.length === 0) return undefined;

  const key = tests.map((words) => keyOfWords(words, scripts, SCRIPT_DEPTH)).join(" && ");

  return { command: tests.map((words) => words.join(" ")).join(" && "), key, scope: key === fullKey(root) ? "full" : "subset", exitKnown: isPlainChain(line) };
}

/**
 * The key of the project's whole test script: what `moku-rails check tests` runs.
 *
 * @param {string} root project root
 * @returns {string | undefined} undefined when `package.json` has no `test` script
 * @example
 * fullKey(root); // "vitest run"
 */
export function fullKey(root) {
  const scripts = readScripts(root);

  return typeof scripts.test === "string" ? keyOfLine(scripts.test, scripts, SCRIPT_DEPTH) : undefined;
}

/**
 * The tree the tests see, as one key: the git tree of every file that is tracked or would be added,
 * edits included. It is the same before and after a commit of those files, and it changes with any
 * edit, so two runs with one key ran on the same files. `.planning/` and `.claude/worktrees/` are left
 * out, like in `cleanHead`. The tree is built in a scratch index and a scratch object folder: the
 * repository gets no object and its index stays untouched. Undefined outside a repository.
 *
 * @param {string} root project root
 * @returns {string | undefined}
 * @example
 * treeKey(process.cwd()); // "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
 */
export function treeKey(root) {
  const scratch = mkdtempSync(join(tmpdir(), "moku-tree-"));

  try {
    const index = join(scratch, "index");
    const realIndex = resolve(root, git(root, {}, "rev-parse", "--git-path", "index"));
    if (existsSync(realIndex)) copyFileSync(realIndex, index);

    // New objects go to the scratch folder; the repository's own are only read
    mkdirSync(join(scratch, "objects"));
    const environment = { GIT_INDEX_FILE: index, GIT_OBJECT_DIRECTORY: join(scratch, "objects"), GIT_ALTERNATE_OBJECT_DIRECTORIES: resolve(root, git(root, {}, "rev-parse", "--git-path", "objects")) };
    git(root, environment, "add", "-A", "--", ":/");
    git(root, environment, "rm", "-r", "-q", "--cached", "--ignore-unmatch", "--", ".planning", ".claude/worktrees");

    return git(root, environment, "write-tree");
  } catch {
    return undefined;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * The last run that already answers this command on this tree: the same command, or a green run of the
 * whole script that the command is a part of. A part is the script with a path, a project or a test name
 * added; any other flag (coverage, a snapshot update) asks something the whole run did not answer.
 * A tree without a key answers nothing.
 *
 * @param {TestRun[]} runs the log, oldest first
 * @param {TestCommand} test
 * @param {string | undefined} tree
 * @returns {TestRun | undefined}
 * @example
 * earlierRun(readRuns(root), testCommand("bun run test", root), treeKey(root))?.outcome; // "green"
 */
export function earlierRun(runs, test, tree) {
  if (!tree) return undefined;

  const isPartOf = (/** @type {TestRun} */ run) => run.outcome === "green" && run.scope === "full" && test.key.startsWith(`${run.key} `) && NARROWING.test(test.key.slice(run.key.length));

  return runs.findLast((run) => run.tree === tree && (run.key === test.key || isPartOf(run)));
}

/**
 * Remember that a run started, until its end is reported under the same id.
 *
 * @param {string} root project root
 * @param {string} id the tool call the run belongs to
 * @param {Record<string, unknown>} start what the end of the run needs: the time, the tree, the command
 * @example
 * startRun(root, "toolu_01", { at: new Date().toISOString(), tree: treeKey(root) });
 */
export function startRun(root, id, start) {
  const folder = join(root, PENDING_DIR);
  mkdirSync(folder, { recursive: true });

  // A run that was interrupted never reports back; its start is dropped here
  for (const name of readdirSync(folder)) {
    if (Date.now() - statSync(join(folder, name)).mtimeMs > PENDING_STALE_MS) rmSync(join(folder, name), { force: true });
  }

  writeFileSync(pendingFile(root, id), `${JSON.stringify(start)}\n`);
}

/**
 * Take back what `startRun` kept. The start is removed: a run ends once.
 *
 * @param {string} root project root
 * @param {string} id
 * @returns {Record<string, any> | undefined} undefined when no start was kept under this id
 * @example
 * takeStart(root, "toolu_01")?.tree;
 */
export function takeStart(root, id) {
  const file = pendingFile(root, id);

  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  } finally {
    rmSync(file, { force: true });
  }
}

/**
 * Append one run to the log.
 *
 * @param {string} root project root
 * @param {TestRun} run
 * @example
 * appendRun(root, { at: new Date().toISOString(), command: "bun run test", key: "vitest run", scope: "full", outcome: "green", by: "agent", ms: 9400 });
 */
export function appendRun(root, run) {
  mkdirSync(join(root, TESTS_DIR), { recursive: true });
  appendFileSync(join(root, RUNS_FILE), `${JSON.stringify(run)}\n`);
}

/**
 * Every recorded run, oldest first. A line that is not valid JSON is skipped.
 *
 * @param {string} root project root
 * @returns {TestRun[]}
 * @example
 * readRuns(root).length; // 0 before the first run
 */
export function readRuns(root) {
  const file = join(root, RUNS_FILE);
  if (!existsSync(file)) return [];

  /** @type {TestRun[]} */
  const runs = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    try {
      if (line.trim() !== "") runs.push(JSON.parse(line));
    } catch {
      /* a half-written line */
    }
  }

  return runs;
}

/**
 * Keep the whole output of the rails' last test run, so a red run is read from the file and not run again.
 *
 * @param {string} root project root
 * @param {string} output
 * @returns {string} the project-relative path of the file
 * @example
 * saveOutput(root, "…"); // ".planning/tests/last.log"
 */
export function saveOutput(root, output) {
  mkdirSync(join(root, TESTS_DIR), { recursive: true });
  writeFileSync(join(root, OUTPUT_FILE), output);

  return OUTPUT_FILE;
}

/**
 * The project's slow-test threshold: `slowTestMs` in `.claude/moku.local.md`, or the default.
 *
 * @param {string} root project root
 * @returns {number} milliseconds
 * @example
 * slowThreshold(root); // 1000
 */
export function slowThreshold(root) {
  try {
    const value = Number(SLOW_SETTING.exec(readFileSync(join(root, SETTINGS_FILE), "utf8"))?.[1]);

    return Number.isFinite(value) && value > 0 ? value : SLOW_TEST_MS;
  } catch {
    return SLOW_TEST_MS;
  }
}

/**
 * The log as numbers: how many runs, how many of them repeated a run on an unchanged tree and what that
 * cost, and the slow tests. A slow test is taken from its latest timing in the recent runs.
 *
 * @param {TestRun[]} runs the log, oldest first
 * @param {number} thresholdMs
 * @returns {TestReport}
 * @example
 * summarize(readRuns(root), slowThreshold(root)).redundant; // 0
 */
export function summarize(runs, thresholdMs) {
  const repeated = (/** @type {(run: TestRun) => boolean} */ pick) => runs.filter((run) => run.repeats !== undefined && pick(run));
  const wall = (/** @type {TestRun[]} */ list) => list.reduce((total, run) => total + (run.ms ?? 0), 0);

  /** @type {Record<string, number>} */
  const by = {};
  for (const run of runs) by[run.by] = (by[run.by] ?? 0) + 1;

  const redundant = repeated((run) => run.repeats === "green");
  const repeats = repeated((run) => run.repeats !== "green");

  return { runs: runs.length, ...(runs[0] ? { since: runs[0].at } : {}), by, ms: wall(runs), redundant: redundant.length, redundantMs: wall(redundant), repeats: repeats.length, repeatsMs: wall(repeats), thresholdMs, slow: slowTests(runs, thresholdMs) };
}

/**
 * @param {TestRun[]} runs oldest first
 * @param {number} thresholdMs
 * @returns {Timing[]} the slow tests of the recent runs, slowest first
 */
function slowTests(runs, thresholdMs) {
  // The latest timing of a test wins: an old slow timing of a test that was fixed is gone
  /** @type {Map<string, number>} */
  const latest = new Map();
  for (const run of runs.slice(-RECENT_RUNS)) {
    for (const timing of run.slowest ?? []) latest.set(timing.name, timing.ms);
  }

  // A file whose slow test is listed by name is explained by that test
  const slow = [...latest].map(([name, ms]) => ({ name, ms })).filter((timing) => timing.ms >= thresholdMs);
  const explained = (/** @type {Timing} */ file) => slow.some((timing) => timing.name.startsWith(`${file.name} > `));

  return slow.filter((timing) => !explained(timing)).toSorted((a, b) => b.ms - a.ms).slice(0, SLOW_LISTED);
}

/**
 * The command a segment really starts: without `VAR=value` assignments and without the wrappers that
 * only launch another program (`bunx`, `npx`, `bun --bun`, `time`, `timeout 60`).
 *
 * @param {string[]} words one simple command
 * @returns {string[]} empty when the segment starts nothing
 * @example
 * invoked(["CI=1", "bunx", "vitest", "run"]); // ["vitest", "run"]
 */
function invoked(words) {
  const first = words.findIndex((word) => !ASSIGNMENT.test(word));
  let rest = first === -1 ? [] : words.slice(first);

  while (rest.length > 0) {
    rest = [posix.basename(rest[0]), ...rest.slice(1)];

    if (WRAPPERS.has(rest[0])) rest = rest.slice(1);
    else if (rest[0] === "timeout") rest = rest.slice(2);
    else if (rest[0] === "bun" && rest[1] === "--bun") rest = ["bun", ...rest.slice(2)];
    else if ((rest[0] === "bun" && rest[1] === "x") || ((rest[0] === "pnpm" || rest[0] === "yarn") && (rest[1] === "exec" || rest[1] === "dlx"))) rest = rest.slice(2);
    else if (rest[0] === "bun" && RUNNERS.has(rest[1])) rest = rest.slice(1);
    else break;
  }

  return rest;
}

/**
 * @param {string[]} words an invoked command
 * @returns {boolean} whether it runs tests once: a test script, or a runner that is not watching
 */
function isTest(words) {
  if (words.includes("--watch")) return false;

  const call = scriptCall(words);
  if (call) return TEST_SCRIPT.test(call.script);

  const [name, verb] = words;
  if (name === "vitest") return verb !== "watch" && verb !== "dev";
  if (name === "playwright" || name === "bun") return verb === "test";

  return name === "jest" || (name === "node" && words.includes("--test"));
}

/**
 * A call of a `package.json` script through a package manager or `node --run`.
 *
 * @param {string[]} words an invoked command
 * @returns {{ script: string, args: string[] } | undefined}
 * @example
 * scriptCall(["bun", "run", "test:unit", "--", "src/a.test.ts"]); // { script: "test:unit", args: ["src/a.test.ts"] }
 */
function scriptCall([name, verb, ...rest]) {
  const args = (/** @type {string[]} */ list) => (list[0] === "--" ? list.slice(1) : list);

  if ((MANAGERS.has(name) && verb === "run") || (name === "node" && verb === "--run")) return rest[0] ? { script: rest[0], args: args(rest.slice(1)) } : undefined;

  // `bun test` is bun's own runner, never the script
  if (MANAGERS.has(name) && name !== "bun" && verb === "test") return { script: "test", args: args(rest) };
  if ((name === "pnpm" || name === "yarn") && TEST_SCRIPT.test(verb ?? "")) return { script: verb, args: args(rest) };

  return undefined;
}

/**
 * The key of one invoked command: a script call is replaced by what the script starts.
 *
 * @param {string[]} words an invoked command
 * @param {Record<string, unknown>} scripts the `scripts` of `package.json`
 * @param {number} depth how many more script calls may be followed
 * @returns {string}
 */
function keyOfWords(words, scripts, depth) {
  const call = scriptCall(words);
  const body = call ? scripts[call.script] : undefined;
  if (!call || typeof body !== "string" || depth === 0) return words.join(" ");

  return [keyOfLine(body, scripts, depth - 1), ...call.args].join(" ");
}

/**
 * The key of a script body: each of its commands by its own key. A body with a pipe is kept as written.
 *
 * @param {string} line
 * @param {Record<string, unknown>} scripts
 * @param {number} depth
 * @returns {string}
 */
function keyOfLine(line, scripts, depth) {
  const segments = shellCommands(line);
  if (segments.some((segment) => segment.piped)) return line.trim();

  return segments.map((segment) => keyOfWords(invoked(segment.words), scripts, depth)).join(" && ");
}

/**
 * True when the line is commands joined by `&&` and nothing else: then it exits 0 only when the tests did.
 * A pipe, a `;`, a `||` or a background `&` hides the test's own exit status.
 *
 * @param {string} line
 * @returns {boolean}
 * @example
 * isPlainChain("cd app && bun run test 2>&1"); // true
 * isPlainChain("bun run test | tail -5"); // false
 */
function isPlainChain(line) {
  const bare = line.replace(/\d*>&\d*-?/g, "").replace(/&>>?/g, "").replaceAll("&&", "").trim();

  return !/[|;&\n`]|\$\(/.test(bare);
}

/**
 * @param {string} root project root
 * @returns {Record<string, unknown>} the `scripts` of `package.json`, or none
 */
function readScripts(root) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
  } catch {
    return {};
  }
}

/**
 * @param {string} root project root
 * @param {string} id
 * @returns {string}
 */
function pendingFile(root, id) {
  return join(root, PENDING_DIR, `${id.replace(/[^\w-]/g, "_")}.json`);
}

/**
 * @param {string} cwd
 * @param {Record<string, string>} environment added to the process environment
 * @param {...string} args
 * @returns {string} what git printed, trimmed; throws when git fails
 */
function git(cwd, environment, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...environment }, stdio: ["ignore", "pipe", "ignore"], timeout: 4000 }).trim();
}
