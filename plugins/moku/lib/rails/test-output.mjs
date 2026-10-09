/**
 * What a test runner printed: the totals and the timings of the slowest tests.
 *
 * One concern: read the output of the runners moku projects use (Vitest, `bun test`, `node --test`).
 * An output that is not recognised yields nothing: no totals and no timings, never a guess.
 */

/**
 * @typedef {object} Timing
 * @property {string} name the test file, or `file > test` when the runner timed one test
 * @property {number} ms
 */

/**
 * @typedef {object} TestOutput
 * @property {"vitest" | "bun" | "node"} runner
 * @property {number} passed
 * @property {number} failed
 * @property {number} [ms] the duration the runner reported for the whole run
 * @property {Timing[]} slowest the slowest timed entries, slowest first, at most `KEEP_SLOWEST`
 */

/** How many timings one run keeps. */
export const KEEP_SLOWEST = 5;

const ANSI = /\u001B\[[0-9;?]*[A-Za-z]/g;

const VITEST_TOTALS = /^\s*(Test Files|Tests)\s{2,}(.+?)\s*\(\d+\)\s*$/gm;
const VITEST_ERRORS = /^\s*Errors\s{2,}(\d+) errors?\b/gm;
const VITEST_THRESHOLD = /does not meet (?:global )?threshold/;
const VITEST_DURATION = /^\s*Duration\s{2,}([\d.]+)\s?(ms|s)\b/gm;
const VITEST_FILE = /^\s*[✓❯×]\s+(?:\S.*?\s)??(\S+)\s+\(\d+ tests?[^)]*\)\s+([\d.]+)\s?(ms|s)\s*$/;
const VITEST_TEST = /^\s{3,}[✓×]\s+(.+?)\s+([\d.]+)\s?(ms|s)\s*$/;

const BUN_RAN = /^Ran \d+ tests? across \d+ files?\.(?:\s+\[([\d.]+)(ms|s)\])?/m;
const BUN_PASS = /^\s*(\d+) pass$/m;
const BUN_FAIL = /^\s*(\d+) fail$/m;
const BUN_FILE = /^(\S+\.[cm]?[jt]sx?):$/;
const BUN_TEST = /^(?:\(pass\)|\(fail\)|✓|✗)\s+(.+?)\s+\[([\d.]+)(ms|s)\]\s*$/;

const NODE_PASS = /^[ℹ#] pass (\d+)$/m;
const NODE_FAIL = /^[ℹ#] fail (\d+)$/m;
const NODE_DURATION = /^[ℹ#] duration_ms ([\d.]+)$/m;
const NODE_SUITE = /^\s*▶\s+(.+?)\s*$/;
const NODE_TEST = /^\s*[✔✖]\s+(.+?)\s+\(([\d.]+)ms\)\s*$/;

/**
 * Read what a test run printed. The first runner whose totals are found wins.
 *
 * @param {string} text stdout and stderr of the run, or the part of it that is left after a filter
 * @returns {TestOutput | undefined} undefined when no runner's totals are in the text
 * @example
 * parseTestOutput(" ✓ tests/unit/a.test.ts (3 tests) 4ms\n Test Files  1 passed (1)\n      Tests  3 passed (3)\n");
 * // { runner: "vitest", passed: 3, failed: 0, slowest: [{ name: "tests/unit/a.test.ts", ms: 4 }] }
 */
export function parseTestOutput(text) {
  const plain = withoutColour(text);

  return readVitest(plain) ?? readBun(plain) ?? readNode(plain);
}

/**
 * The text as a person reads it: without the terminal's colour codes.
 *
 * @param {unknown} text
 * @returns {string}
 * @example
 * withoutColour("\u001B[32m3 passed\u001B[39m"); // "3 passed"
 */
export function withoutColour(text) {
  return String(text ?? "").replace(ANSI, "");
}

/**
 * The part of a parsed output a run record keeps: the totals and the slowest timings.
 *
 * @param {TestOutput | undefined} output
 * @returns {{ passed?: number, failed?: number, slowest?: Timing[] }} empty when nothing was read
 * @example
 * readings(parseTestOutput(text)); // { passed: 3, failed: 0, slowest: [{ name: "tests/unit/a.test.ts", ms: 4 }] }
 */
export function readings(output) {
  if (!output) return {};

  return { passed: output.passed, failed: output.failed, ...(output.slowest.length > 0 ? { slowest: output.slowest } : {}) };
}

/**
 * The verdict of a parsed output: red with one failure, green with passes and none, otherwise nothing.
 *
 * @param {TestOutput | undefined} output
 * @returns {"green" | "red" | undefined}
 * @example
 * outcomeOf({ runner: "bun", passed: 3, failed: 0, slowest: [] }); // "green"
 */
export function outcomeOf(output) {
  if (!output) return undefined;
  if (output.failed > 0) return "red";

  return output.passed > 0 ? "green" : undefined;
}

/**
 * Vitest: the `Tests` and `Test Files` totals, one line per file with its duration, and one line per
 * test the reporter chose to list (a slow or a failed one). Several runs in one output are added up.
 *
 * @param {string} plain output without colour codes
 * @returns {TestOutput | undefined}
 */
function readVitest(plain) {
  const totals = [...plain.matchAll(VITEST_TOTALS)];
  if (totals.length === 0) return undefined;

  // Failed files count when no test line names a failure: a file that did not load has no tests
  const count = (/** @type {string} */ label, /** @type {string} */ word) => sum(totals.filter((match) => match[1] === label).map((match) => Number(new RegExp(`(\\d+) ${word}`).exec(match[2])?.[1] ?? 0)));
  const errors = sum([...plain.matchAll(VITEST_ERRORS)].map((match) => Number(match[1]))) + (VITEST_THRESHOLD.test(plain) ? 1 : 0);
  const failed = Math.max(count("Tests", "failed"), count("Test Files", "failed")) + errors;

  // Timings: a test line belongs to the file line above it
  /** @type {Timing[]} */
  const timings = [];
  let file = "";
  for (const line of plain.split("\n")) {
    const fileLine = VITEST_FILE.exec(line);
    if (fileLine) {
      file = fileLine[1];
      timings.push({ name: file, ms: toMs(fileLine[2], fileLine[3]) });
      continue;
    }

    const testLine = VITEST_TEST.exec(line);
    if (testLine) timings.push({ name: file ? `${file} > ${testLine[1]}` : testLine[1], ms: toMs(testLine[2], testLine[3]) });
  }

  const durations = [...plain.matchAll(VITEST_DURATION)].map((match) => toMs(match[1], match[2]));

  return { runner: "vitest", passed: count("Tests", "passed"), failed, ...(durations.length > 0 ? { ms: sum(durations) } : {}), slowest: slowest(timings) };
}

/**
 * `bun test`: the `N pass` and `N fail` totals, and one line per test with its time in brackets.
 *
 * @param {string} plain output without colour codes
 * @returns {TestOutput | undefined}
 */
function readBun(plain) {
  const ran = BUN_RAN.exec(plain);
  const pass = BUN_PASS.exec(plain);
  const fail = BUN_FAIL.exec(plain);
  if (!ran || (!pass && !fail)) return undefined;

  /** @type {Timing[]} */
  const timings = [];
  let file = "";
  for (const line of plain.split("\n")) {
    const fileLine = BUN_FILE.exec(line);
    if (fileLine) file = fileLine[1];

    const testLine = BUN_TEST.exec(line);
    if (testLine) timings.push({ name: file ? `${file} > ${testLine[1]}` : testLine[1], ms: toMs(testLine[2], testLine[3]) });
  }

  return { runner: "bun", passed: Number(pass?.[1] ?? 0), failed: Number(fail?.[1] ?? 0), ...(ran[1] ? { ms: toMs(ran[1], ran[2]) } : {}), slowest: slowest(timings) };
}

/**
 * `node --test`: the `pass` and `fail` totals of the spec and TAP reporters, and the spec reporter's one
 * line per test. The closing line of a suite repeats the time of its tests, so it is left out.
 *
 * @param {string} plain output without colour codes
 * @returns {TestOutput | undefined}
 */
function readNode(plain) {
  const pass = NODE_PASS.exec(plain);
  const fail = NODE_FAIL.exec(plain);
  if (!pass || !fail) return undefined;

  /** @type {Timing[]} */
  const timings = [];
  const suites = new Set();
  for (const line of plain.split("\n")) {
    const suite = NODE_SUITE.exec(line);
    if (suite) suites.add(suite[1]);

    const testLine = NODE_TEST.exec(line);
    if (testLine && !suites.has(testLine[1])) timings.push({ name: testLine[1], ms: Math.round(Number(testLine[2])) });
  }

  const duration = NODE_DURATION.exec(plain);

  return { runner: "node", passed: Number(pass[1]), failed: Number(fail[1]), ...(duration ? { ms: Math.round(Number(duration[1])) } : {}), slowest: slowest(timings) };
}

/**
 * @param {Timing[]} timings
 * @returns {Timing[]} the slowest `KEEP_SLOWEST`, slowest first
 */
function slowest(timings) {
  return timings.toSorted((a, b) => b.ms - a.ms).slice(0, KEEP_SLOWEST);
}

/**
 * @param {string} value
 * @param {string} unit `ms` or `s`
 * @returns {number} milliseconds, rounded
 */
function toMs(value, unit) {
  return Math.round(Number(value) * (unit === "s" ? 1000 : 1));
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
