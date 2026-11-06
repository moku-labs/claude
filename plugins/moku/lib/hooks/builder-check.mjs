/**
 * The builder's own checks, run by the hooks instead of trusted from its report: the type check and the tests
 * of the one unit the builder owned, compared with the tree as it was before the builder started.
 *
 * `SubagentStart` takes the baseline: one `tsc --noEmit` of the whole project, in a detached process, so the
 * builder never waits for it. Builders of one wave start within seconds of each other and share one baseline.
 * `SubagentStop` runs `tsc` again, keeps only the errors inside the unit, and drops every error the baseline
 * already had (an error is its file, its code and its message, not its line, which moves with an edit). The
 * tests are the unit's own folder. What is left is the builder's: the stop hook blocks it once with only that.
 *
 * Everything lives under `.planning/build/builder-checks/`; `checks.jsonl` there is the log of every check.
 */

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const CHECKS_DIR = join(".planning", "build", "builder-checks");

/** Only the two builders are checked; the tweaker and the validators have no unit of their own. */
export const BUILDER = /(^|:)moku-builder(-deep)?$/;

/** A baseline started this recently by a sibling builder is shared instead of starting another `tsc`. */
const SHARE_WITHIN_MS = 90_000;
/** How long the stop hook waits for a baseline that is still running. */
const BASELINE_WAIT_MS = Number(process.env.MOKU_BASELINE_WAIT_MS ?? 90_000);
const RUN_TIMEOUT_MS = 150_000;
/** What the block shows: the first errors and failures, each cut short. */
const MAX_ITEMS = 12;
const MAX_ITEM_CHARS = 400;
const MAX_REASON_CHARS = 4000;

/** @typedef {{ file: string, line: number, code: string, message: string }} TscError */
/** @typedef {{ name: string, message: string }} TestFailure */
/** @typedef {{ dirs: string[], files: string[] }} Scope */

/**
 * The project's own `tsc`, or undefined when it has none: a hook never installs or downloads a tool.
 *
 * @param {string} root project root
 * @returns {string | undefined}
 */
export function tscBinary(root) {
  const bin = join(root, "node_modules", ".bin", "tsc");
  return existsSync(bin) && existsSync(join(root, "tsconfig.json")) ? bin : undefined;
}

/**
 * Parse `tsc --pretty false` output. A message that goes on over indented lines keeps only its first line.
 *
 * @param {string} output
 * @returns {TscError[]}
 * @example
 * parseTsc("src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.");
 * // [{ file: "src/a.ts", line: 3, code: "TS2322", message: "Type 'string' is not assignable to type 'number'." }]
 */
export function parseTsc(output) {
  const errors = [];
  for (const line of output.split("\n")) {
    const match = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(line.trimEnd());
    if (match) errors.push({ file: toPosix(match[1]), line: Number(match[2]), code: match[3], message: match[4] });
  }

  return errors;
}

/**
 * Run the project's `tsc --noEmit` and parse what it reports. Undefined when there is no `tsc` or it did not finish.
 *
 * @param {string} root project root
 * @returns {TscError[] | undefined}
 */
export function runTsc(root) {
  const bin = tscBinary(root);
  if (!bin) return undefined;

  const run = spawnSync(bin, ["--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8", timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (run.error || run.status === null) return undefined;

  return parseTsc(`${run.stdout ?? ""}\n${run.stderr ?? ""}`);
}

/**
 * The errors of `current` that the baseline does not have, counted: two equal errors where the baseline had one is one new.
 *
 * @param {TscError[]} current
 * @param {TscError[]} baseline
 * @returns {TscError[]}
 * @example
 * newErrors([a, a, b], [a]); // [a, b]
 */
export function newErrors(current, baseline) {
  const left = new Map();
  for (const error of baseline) left.set(errorKey(error), (left.get(errorKey(error)) ?? 0) + 1);

  return current.filter((error) => {
    const count = left.get(errorKey(error)) ?? 0;
    if (count === 0) return true;

    left.set(errorKey(error), count - 1);
    return false;
  });
}

/**
 * The unit a builder owned, from the files of its report: its plugin or feature folder when every file is in one,
 * otherwise the files themselves (a Layer-3 unit spans pages, components and `lib/`).
 *
 * @param {string} root project root
 * @param {{ plugin?: unknown, files?: unknown }} contract the builder's report
 * @returns {Scope | undefined}
 * @example
 * unitScope("/p", { plugin: "board", files: ["features/board/index.ts"] }); // { dirs: ["features/board"], files: [] }
 */
export function unitScope(root, contract) {
  const files = (Array.isArray(contract.files) ? contract.files : []).filter((file) => typeof file === "string").map((file) => toPosix(relative(root, resolve(root, file))));
  const unitDir = (file) => /^((?:src\/)?(?:plugins|features)\/[^/]+)\//.exec(file)?.[1];

  const dirs = [...new Set(files.map(unitDir))];
  if (files.length > 0 && dirs.length === 1 && dirs[0]) return { dirs: [dirs[0]], files: [] };
  if (files.length > 0) return { dirs: [], files: files.filter((file) => !file.startsWith("..")) };

  const name = typeof contract.plugin === "string" ? contract.plugin : "";
  const dir = ["src/plugins", "features", "plugins"].map((base) => `${base}/${name}`).find((candidate) => name && existsSync(join(root, candidate)));

  return dir ? { dirs: [dir], files: [] } : undefined;
}

/**
 * @param {Scope} scope
 * @param {string} file posix path relative to the root
 * @returns {boolean}
 */
export function inScope(scope, file) {
  return scope.dirs.some((dir) => file.startsWith(`${dir}/`)) || scope.files.includes(file);
}

/**
 * Run the unit's tests with the project's runner, two workers at most (sibling builders run theirs at the same time).
 * Undefined when the project has no runner, or the unit has no test to run.
 *
 * @param {string} root project root
 * @param {Scope} scope
 * @returns {{ runner: string, failures: TestFailure[] } | undefined}
 */
export function runTests(root, scope) {
  const targets = scope.dirs.length > 0 ? scope.dirs : scope.files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
  if (targets.length === 0) return undefined;

  const vitest = join(root, "node_modules", ".bin", "vitest");
  if (existsSync(vitest) && dependsOn(root, "vitest")) return runVitest(root, vitest, targets);

  const bun = spawnSync("bun", ["--version"], { encoding: "utf8" });
  if (bun.status === 0) return runBun(root, targets);

  return undefined;
}

/**
 * Start the baseline for one builder, or share one a sibling started moments ago. Never waits for `tsc`.
 *
 * @param {string} root project root
 * @param {string} agentId
 */
export function startBaseline(root, agentId) {
  if (!tscBinary(root)) return;

  const dir = join(root, CHECKS_DIR);
  mkdirSync(dir, { recursive: true });

  const now = Date.now();
  const shared = readdirSync(dir).filter((name) => /^tsc-\d+\.json$/.test(name)).map((name) => Number(name.slice(4, -5))).filter((started) => now - started < SHARE_WITHIN_MS).sort().at(-1);
  const file = `tsc-${shared ?? now}.json`;
  writeFileSync(join(dir, `${safe(agentId)}.agent.json`), JSON.stringify({ baseline: file, startedAt: new Date(now).toISOString() }));
  if (shared) return;

  writeFileSync(join(dir, file), JSON.stringify({ status: "running" }));
  const script = fileURLToPath(import.meta.url);
  spawn(process.execPath, [script, "baseline", root, join(dir, file)], { cwd: root, detached: true, stdio: "ignore" }).unref();
}

/**
 * The baseline for one builder: waits while its `tsc` is still running. A retry of a unit whose earlier build
 * failed is compared with the baseline of that first attempt, so the errors the failed attempt left are still
 * the builder's. Undefined when there is none.
 *
 * @param {string} root project root
 * @param {string} agentId
 * @param {Scope} scope the unit, to find an earlier failed attempt on it
 * @returns {{ file: string, errors: TscError[] } | undefined}
 */
export function readBaseline(root, agentId, scope) {
  const record = readJson(join(root, CHECKS_DIR, `${safe(agentId)}.agent.json`));
  const own = typeof record?.baseline === "string" ? record.baseline : undefined;
  const file = earlierFailedBaseline(root, scope) ?? own;
  if (!file) return undefined;

  const deadline = Date.now() + BASELINE_WAIT_MS;
  for (;;) {
    const baseline = readJson(join(root, CHECKS_DIR, file));
    if (baseline?.status === "done" && Array.isArray(baseline.errors)) return { file, errors: baseline.errors };
    if (baseline?.status !== "running" || Date.now() >= deadline) return undefined;

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
}

/**
 * The baseline file of the first failed attempt on this unit since it last passed, while that file is still there.
 *
 * @param {string} root
 * @param {Scope} scope
 * @returns {string | undefined}
 */
function earlierFailedBaseline(root, scope) {
  let lines = [];
  try {
    lines = readFileSync(join(root, CHECKS_DIR, "checks.jsonl"), "utf8").split("\n").filter(Boolean);
  } catch {
    return undefined;
  }

  // The first failure after the unit last passed clean: an attempt that passed closes the chain of retries
  const key = scopeKey(scope);
  let first;
  for (const line of lines) {
    const entry = readJsonText(line);
    if (!entry?.scope || scopeKey(entry.scope) !== key) continue;

    const failed = entry.verdict !== "PASS" || entry.blocked === true || entry.stillFailing === true;
    if (!failed) first = undefined;
    else first ??= typeof entry.baselineFile === "string" ? entry.baselineFile : undefined;
  }

  return first && existsSync(join(root, CHECKS_DIR, first)) ? first : undefined;
}

/**
 * The baseline file a builder was given at its start, for the log.
 *
 * @param {string} root
 * @param {string} agentId
 * @returns {string | undefined}
 */
export function baselineFileOf(root, agentId) {
  const record = readJson(join(root, CHECKS_DIR, `${safe(agentId)}.agent.json`));
  return typeof record?.baseline === "string" ? record.baseline : undefined;
}

/**
 * Without a baseline: an error in a file that git has unchanged since HEAD was there before the builder.
 *
 * @param {string} root project root
 * @param {TscError[]} errors
 * @returns {TscError[]}
 */
export function changedFileErrors(root, errors) {
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0) return errors;

  const changed = new Set(status.stdout.split("\n").filter(Boolean).map((line) => toPosix(line.slice(3).split(" -> ").at(-1) ?? "")));
  return errors.filter((error) => changed.has(error.file));
}

/**
 * Whether this builder was already blocked once by its checks; marks it when asked.
 *
 * @param {string} root project root
 * @param {string} agentId
 * @param {boolean} [mark]
 * @returns {boolean}
 */
export function blockedBefore(root, agentId, mark = false) {
  const file = join(root, CHECKS_DIR, `${safe(agentId)}.blocked`);
  const before = existsSync(file);
  if (mark) {
    mkdirSync(join(root, CHECKS_DIR), { recursive: true });
    writeFileSync(file, new Date().toISOString());
  }

  return before;
}

/**
 * Drop this builder's records and baselines nobody needs any more (older than six hours).
 *
 * @param {string} root project root
 * @param {string} agentId
 */
export function forgetBuilder(root, agentId) {
  const dir = join(root, CHECKS_DIR);
  for (const suffix of [".agent.json", ".blocked"]) rmSync(join(dir, `${safe(agentId)}${suffix}`), { force: true });

  try {
    for (const name of readdirSync(dir)) {
      if (/^tsc-\d+\.json$/.test(name) && Date.now() - statSync(join(dir, name)).mtimeMs > 6 * 60 * 60 * 1000) rmSync(join(dir, name), { force: true });
    }
  } catch {
    /* nothing to clean */
  }
}

/**
 * One line of `checks.jsonl`.
 *
 * @param {string} root project root
 * @param {Record<string, unknown>} entry
 */
export function logCheck(root, entry) {
  try {
    mkdirSync(join(root, CHECKS_DIR), { recursive: true });
    appendFileSync(join(root, CHECKS_DIR, "checks.jsonl"), `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
  } catch {
    /* the log never fails the hook */
  }
}

/**
 * The block's reason: what failed and nothing else, cut short.
 *
 * @param {Scope} scope
 * @param {TscError[]} errors new type errors in the unit
 * @param {TestFailure[]} failures failing tests of the unit
 * @returns {string}
 */
export function blockReason(scope, errors, failures) {
  const where = [...scope.dirs, ...scope.files].join(", ");
  const parts = [`Your report says PASS, but the hook's own check of your unit (${where}) fails. Fix it inside your unit, run the check again, then deliver the report again. If you cannot fix it, report FAIL with it in blockers. Errors that were there before you started are left out.`];

  if (errors.length > 0) {
    parts.push(`tsc: ${errors.length} new error${errors.length === 1 ? "" : "s"}`);
    for (const error of errors.slice(0, MAX_ITEMS)) parts.push(cut(`  ${error.file}:${error.line} ${error.code} ${error.message}`));
    if (errors.length > MAX_ITEMS) parts.push(`  … ${errors.length - MAX_ITEMS} more`);
  }

  if (failures.length > 0) {
    parts.push(`tests: ${failures.length} failing`);
    for (const failure of failures.slice(0, MAX_ITEMS)) parts.push(cut(`  ✗ ${failure.name}${failure.message ? `\n    ${failure.message.split("\n").slice(0, 6).join("\n    ")}` : ""}`));
    if (failures.length > MAX_ITEMS) parts.push(`  … ${failures.length - MAX_ITEMS} more`);
  }

  const reason = parts.join("\n");
  return reason.length > MAX_REASON_CHARS ? `${reason.slice(0, MAX_REASON_CHARS)}\n  …` : reason;
}

// --- internals -------------------------------------------------------------

/** @param {TscError} error */
function errorKey(error) {
  return `${error.file}|${error.code}|${error.message}`;
}

/** @param {string} path */
function toPosix(path) {
  return path.split(sep).join(posix.sep).replace(/^\.\//, "");
}

/** @param {string} id */
function safe(id) {
  return id.replace(/[^\w.-]/g, "_");
}

/** @param {Scope} scope */
function scopeKey(scope) {
  return JSON.stringify([[...(scope.dirs ?? [])].sort(), [...(scope.files ?? [])].sort()]);
}

/** @param {string} text */
function readJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * @param {string} root
 * @param {string} name
 */
function dependsOn(root, name) {
  const pkg = readJson(join(root, "package.json"));
  return Boolean(pkg?.dependencies?.[name] ?? pkg?.devDependencies?.[name]);
}

/** @param {string} text */
function cut(text) {
  return text.length > MAX_ITEM_CHARS ? `${text.slice(0, MAX_ITEM_CHARS)}…` : text;
}

/**
 * @param {string} root
 * @param {string} bin
 * @param {string[]} targets
 */
function runVitest(root, bin, targets) {
  mkdirSync(join(root, CHECKS_DIR), { recursive: true });
  const out = join(root, CHECKS_DIR, `vitest-${process.pid}.json`);
  const run = spawnSync(bin, ["run", ...targets, "--maxWorkers=2", "--passWithNoTests", "--reporter=json", `--outputFile=${out}`], { cwd: root, encoding: "utf8", timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const report = readJson(out);
  rmSync(out, { force: true });
  if (run.error || run.status === null) return undefined;
  if (!report) return run.status === 0 ? { runner: "vitest", failures: [] } : { runner: "vitest", failures: [{ name: "vitest did not run", message: lastLines(`${run.stdout}\n${run.stderr}`) }] };

  const failures = [];
  for (const suite of report.testResults ?? []) {
    const failed = (suite.assertionResults ?? []).filter((test) => test.status === "failed");
    for (const test of failed) failures.push({ name: `${toPosix(relative(root, suite.name ?? ""))} > ${test.fullName ?? test.title}`, message: String(test.failureMessages?.[0] ?? "") });
    if (failed.length === 0 && suite.status === "failed") failures.push({ name: toPosix(relative(root, suite.name ?? "")), message: String(suite.message ?? "") });
  }

  return { runner: "vitest", failures };
}

/**
 * @param {string} root
 * @param {string[]} targets
 */
function runBun(root, targets) {
  const run = spawnSync("bun", ["test", ...targets.map((target) => `./${target}`)], { cwd: root, encoding: "utf8", timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (run.error || run.status === null) return undefined;

  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  if (/0 test files matching|No tests found/i.test(output)) return undefined;

  const failures = output.split("\n").filter((line) => line.startsWith("(fail)")).map((line) => ({ name: line.slice(6).trim(), message: "" }));
  if (run.status !== 0 && failures.length === 0) failures.push({ name: "bun test failed", message: lastLines(output) });

  return { runner: "bun", failures };
}

/** @param {string} text */
function lastLines(text) {
  return text.trim().split("\n").slice(-8).join("\n");
}

// `node builder-check.mjs baseline <root> <file>`: the detached baseline run that `startBaseline` starts
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === "baseline") {
  const [, , , root, file] = process.argv;
  const errors = runTsc(root);
  writeFileSync(file, JSON.stringify(errors ? { status: "done", errors } : { status: "failed" }));
}
