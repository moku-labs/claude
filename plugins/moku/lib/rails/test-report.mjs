/**
 * The test-run log in words: the lines `moku-rails tests`, `status` and `close` print, and the advice
 * the Bash hook gives an agent.
 *
 * One concern: wording. The numbers come from test-runs.mjs, the hook facts from commit-hook.mjs.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {import("./test-runs.mjs").TestReport} TestReport */
/** @typedef {import("./test-runs.mjs").TestRun} TestRun */
/** @typedef {import("./commit-hook.mjs").CommitHook} CommitHook */

/** The one place the test-run policy is written down; advice points an agent at it. */
export const POLICY_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills", "moku-testing", "references", "test-runs.md");

const SOURCES = { agent: "by agents", rails: "by the rails", hook: "by the commit hook" };
const KEEP_OUTPUT = 'keep the output of one run in a file (`<command> > "$TMPDIR/moku-test.log" 2>&1; echo "exit $?"`) and read the file';

/**
 * The whole report, one fact per line.
 *
 * @param {TestReport} report
 * @param {CommitHook | undefined} hook
 * @returns {string[]}
 * @example
 * reportLines(summarize(readRuns(root), slowThreshold(root)), commitHook(root));
 * // ["Test runs: 14 since 2026-10-09 (9 by agents, 3 by the rails, 2 by the commit hook), 312 s in tests.", "Redundant: none.", …, "Policy: …/test-runs.md"]
 */
export function reportLines(report, hook) {
  return [runsLine(report), redundantLine(report), hookLine(hook), ...slowLines(report), `Policy: ${POLICY_FILE}`];
}

/**
 * One line for `moku-rails status`, or nothing when the runs hold no waste and no slow test.
 *
 * @param {TestReport} report of the last day's runs
 * @returns {string | undefined}
 * @example
 * statusLine(report); // "Tests: 4 run(s) repeated on an unchanged tree in the last day (41 s), 2 slow test(s). `moku-rails tests` has the list."
 */
export function statusLine(report) {
  const repeated = report.redundant + report.repeats;
  if (repeated === 0 && report.slow.length === 0) return undefined;

  const parts = [...(repeated > 0 ? [`${repeated} run(s) repeated on an unchanged tree in the last day (${seconds(report.redundantMs + report.repeatsMs)})`] : []), ...(report.slow.length > 0 ? [`${report.slow.length} slow test(s)`] : [])];

  return `Tests: ${parts.join(", ")}. \`moku-rails tests\` has the list.`;
}

/**
 * What `moku-rails close` adds when the change closes with slow tests: an offer for the person, never a
 * change to the tests.
 *
 * @param {TestReport} report
 * @returns {string | undefined}
 * @example
 * slowOffer(report); // "Slow tests: 2 at or over 1000 ms, the slowest is `tests/integration/boot.test.ts` (4210 ms). Offer the person …"
 */
export function slowOffer(report) {
  const [worst] = report.slow;
  if (!worst) return undefined;

  return `Slow tests: ${report.slow.length} at or over ${report.thresholdMs} ms, the slowest is \`${worst.name}\` (${worst.ms} ms). Offer the person to speed them up as a change of its own, or keep it for later with \`moku-rails idea\`. \`moku-rails tests\` lists them. Change no test without a yes.`;
}

/**
 * What an agent is told when it starts a test command that already ran on the same tree.
 *
 * @param {string} command the test command as typed
 * @param {TestRun} earlier the run that already answered it
 * @param {number} now milliseconds since the epoch
 * @returns {string}
 * @example
 * repeatAdvice("bun run test", earlier, Date.now());
 * // "moku tests: `bun run test` was already green on this exact tree 14 s ago (by agents). No file changed since, …"
 */
export function repeatAdvice(command, earlier, now) {
  const ago = seconds(Math.max(0, now - Date.parse(earlier.at)));
  const policy = `Policy: ${POLICY_FILE}`;

  if (earlier.outcome === "green") {
    return `moku tests: \`${command}\` was already green on this exact tree ${ago} ago (${SOURCES[earlier.by] ?? earlier.by}). No file changed since, so this run says nothing new and is counted as redundant. Do not run it again on this tree. To read another part of the output, ${KEEP_OUTPUT}. ${policy}`;
  }

  const was = earlier.outcome === "red" ? "was red" : "was not read to its end (a filter hid its exit status and its totals)";

  return `moku tests: \`${command}\` already ran on this exact tree ${ago} ago and ${was}. A repeat without an edit shows the same result. Next time ${KEEP_OUTPUT}. ${policy}`;
}

/**
 * What an agent is told after a commit whose hook proved the tests green.
 *
 * @param {string} head the new commit
 * @param {TestRun | undefined} doubled the green run of the same tests on the same files before the commit
 * @returns {string}
 * @example
 * commitAdvice("3f2a9c1e", undefined); // "moku tests: the commit hook ran the whole test script green on 3f2a9c1. …"
 */
export function commitAdvice(head, doubled) {
  const twice = doubled ? ` The same tests were green on the same files just before the commit (\`${doubled.command}\`), so they ran twice: before a commit, leave the full run to the hook.` : "";

  return `moku tests: the commit hook ran the whole test script green on ${head.slice(0, 7)}. Do not run it again on this tree; \`moku-rails check tests\` accepts the hook's run.${twice}`;
}

/**
 * @param {TestReport} report
 * @returns {string}
 */
function runsLine(report) {
  if (report.runs === 0) return "Test runs: none recorded in this checkout yet.";

  const sources = Object.entries(report.by).map(([source, count]) => `${count} ${SOURCES[/** @type {keyof typeof SOURCES} */ (source)] ?? source}`);

  return `Test runs: ${report.runs} since ${String(report.since).slice(0, 10)} (${sources.join(", ")}), ${seconds(report.ms)} in tests.`;
}

/**
 * @param {TestReport} report
 * @returns {string}
 */
function redundantLine(report) {
  if (report.redundant === 0 && report.repeats === 0) return "Redundant: none.";

  const green = `${report.redundant} run(s) repeated a green result on an unchanged tree, ${seconds(report.redundantMs)} wasted`;
  const other = report.repeats > 0 ? ` ${report.repeats} more repeated a red or unread run without an edit, ${seconds(report.repeatsMs)}.` : "";

  return `Redundant: ${green}.${other}`;
}

/**
 * @param {CommitHook | undefined} hook
 * @returns {string}
 */
function hookLine(hook) {
  if (!hook) return "Commit hook: none found. Nothing runs the tests on a commit here.";
  if (hook.tests.length === 0) return `Commit hook: ${hook.manager} runs no tests on every commit.`;

  const commands = hook.tests.map((test) => `\`${test.command}\``).join(", ");
  const doubt = hook.doubt ? ` Not trusted in this checkout: ${hook.doubt}.` : "";
  if (!hook.full) return `Commit hook: ${hook.manager} runs ${commands} on every commit, which is not the whole test script. A commit proves those commands only; \`moku-rails check tests\` still runs the script.${doubt}`;

  return `Commit hook: ${hook.manager} runs the whole test script on every commit (${commands}). A commit that goes through proves the tests green on the new HEAD: do not run them right before or right after it.${doubt}`;
}

/**
 * @param {TestReport} report
 * @returns {string[]}
 */
function slowLines(report) {
  const knob = "`slowTestMs` in .claude/moku.local.md";
  if (report.slow.length === 0) return [`Slow tests: none at or over ${report.thresholdMs} ms (${knob}).`];

  return [`Slow tests at or over ${report.thresholdMs} ms (${knob}):`, ...report.slow.map((timing) => `  ${String(timing.ms).padStart(6)} ms  ${timing.name}`)];
}

/**
 * @param {number} ms
 * @returns {string} whole seconds, or one decimal under ten seconds
 */
function seconds(ms) {
  return `${ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)} s`;
}
