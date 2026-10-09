#!/usr/bin/env node
/**
 * Bash hook on three events: it sees every test run an agent starts, and every commit that went
 * through the project's own hook.
 *
 * PreToolUse: a test command is remembered with the tree it starts on. When the same command already
 * ran on that tree the agent is told so; that is advice, never a refusal, and a changed tree is never
 * commented on. PostToolUse and PostToolUseFailure: the run goes to the log with its duration and its
 * outcome. After a `git commit`, a hook that ran the whole test script proves the new HEAD green, and
 * `moku-rails check tests` accepts that without another run.
 */

import { homedir } from "node:os";
import { resolve } from "node:path";

import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { commitProof } from "../lib/rails/commit-hook.mjs";
import { findRoot, loadLedger, saveLedger, withLedger } from "../lib/rails/ledger.mjs";
import { headCommit } from "../lib/rails/reconcile.mjs";
import { shellCommands } from "../lib/rails/shell.mjs";
import { outcomeOf, parseTestOutput, readings } from "../lib/rails/test-output.mjs";
import { commitAdvice, repeatAdvice } from "../lib/rails/test-report.mjs";
import { appendRun, earlierRun, fullKey, readRuns, startRun, takeStart, testCommand, treeKey } from "../lib/rails/test-runs.mjs";

const COMMIT = /\bgit\b[^|;&\n]*\bcommit\b/;

const { payload } = readHookInput();
const line = payload.tool_input?.command;
const event = String(payload.hook_event_name ?? "");

if (typeof line !== "string" || typeof payload.tool_use_id !== "string" || railsMode() === "off") process.exit(0);

// Off the rails: test runs are nobody's business
const root = projectOf(payload, line);
if (!root) process.exit(0);

// Only a test command or a commit is looked at
const test = testCommand(line, root);
const commits = COMMIT.test(line);
if (!test && !commits) process.exit(0);

// The log never gets in the way of the call: a run that cannot be recorded goes unrecorded
try {
  if (event === "PreToolUse") before();
  else after();
} catch {
  process.exit(0);
}

/**
 * The start of a run: keep the time, the tree and HEAD for the end, and say so when this tree already
 * has an answer.
 */
function before() {
  const tree = test ? treeKey(root) : undefined;
  const earlier = test ? earlierRun(readRuns(root), test, tree) : undefined;

  startRun(root, payload.tool_use_id, { at: new Date().toISOString(), tree, head: headCommit(root), repeats: earlier?.outcome });

  if (test && earlier) say(repeatAdvice(test.command, earlier, Date.now()));
}

/**
 * The end of a run: write it to the log, and take what a commit proved.
 */
function after() {
  const start = takeStart(root, payload.tool_use_id);
  if (!start) return;

  if (test) appendRun(root, runOf(test, start));
  if (commits && event === "PostToolUse") provenCommit(start);
}

/**
 * The log line of an agent's run. The tree is kept only when it is still the one the run started on.
 *
 * @param {import("../lib/rails/test-runs.mjs").TestCommand} command
 * @param {Record<string, any>} start what `before` kept
 * @returns {import("../lib/rails/test-runs.mjs").TestRun}
 */
function runOf(command, start) {
  const background = payload.tool_input?.run_in_background === true;
  const parsed = parseTestOutput(printed());
  const ms = typeof payload.duration_ms === "number" ? payload.duration_ms : Date.now() - Date.parse(start.at);
  const tree = start.tree && treeKey(root) === start.tree ? start.tree : undefined;

  return {
    at: start.at,
    command: command.command,
    key: command.key,
    scope: command.scope,
    ...(tree ? { tree } : {}),
    ...(background ? {} : { ms }),
    outcome: background || payload.is_interrupt === true ? "unknown" : outcomeFor(command, parsed),
    by: "agent",
    ...(typeof payload.agent_type === "string" ? { agent: payload.agent_type } : {}),
    ...(start.repeats ? { repeats: start.repeats } : {}),
    ...readings(parsed),
  };
}

/**
 * Green, red or unknown. Totals that name a failure are red whatever the exit status says. Without them
 * the exit status decides, and only when it is the test's own: behind a pipe it says nothing.
 *
 * @param {import("../lib/rails/test-runs.mjs").TestCommand} command
 * @param {import("../lib/rails/test-output.mjs").TestOutput | undefined} parsed
 * @returns {import("../lib/rails/test-runs.mjs").Outcome}
 */
function outcomeFor(command, parsed) {
  const read = outcomeOf(parsed);
  if (read === "red") return "red";
  if (event === "PostToolUseFailure") return command.exitKnown ? "red" : "unknown";

  return command.exitKnown ? "green" : (read ?? "unknown");
}

/**
 * A commit that went through a hook running the tests: log the hook's run, and when it was the whole
 * test script, record the new HEAD as green in the ledger.
 *
 * @param {Record<string, any>} start what `before` kept
 */
function provenCommit(start) {
  const proof = commitProof({ root, line, before: start.head, output: printed() });
  if (!proof) return;

  const tree = treeKey(root);
  const runs = readRuns(root);
  const hooked = proof.full ? [{ command: proof.tests.map((entry) => entry.command).join(" && "), key: fullKey(root) ?? "", scope: /** @type {const} */ ("full") }] : proof.tests.map((entry) => ({ command: entry.command, key: entry.key, scope: /** @type {const} */ ("subset") }));

  // The hook's run repeats a run an agent made on the same files just before the commit
  const doubled = hooked.map((entry) => earlierRun(runs, { ...entry, exitKnown: true }, tree));
  for (const [index, entry] of hooked.entries()) {
    appendRun(root, { at: start.at, ...entry, ...(tree ? { tree } : {}), ...(proof.ms !== undefined && hooked.length === 1 ? { ms: proof.ms } : {}), outcome: "green", by: "hook", ...(doubled[index] ? { repeats: doubled[index].outcome } : {}) });
  }

  if (!proof.full) return;

  withLedger(root, () => {
    const ledger = loadLedger(root);
    ledger.testsGreenAt = proof.head;
    saveLedger(root, ledger);
  });
  say(commitAdvice(proof.head, doubled[0]?.outcome === "green" ? doubled[0] : undefined));
}

/**
 * What the command printed: stdout and stderr of a finished call, or the error text of a failed one.
 *
 * @returns {string}
 */
function printed() {
  const response = payload.tool_response;
  if (typeof response === "string") return response;

  return [response?.stdout, response?.stderr, payload.error].filter((part) => typeof part === "string").join("\n");
}

/**
 * The project the command runs in: where its first `cd` leads, or the session's project.
 *
 * @param {Record<string, any>} hookPayload
 * @param {string} command
 * @returns {string | undefined} undefined off the rails
 */
function projectOf(hookPayload, command) {
  const cwd = typeof hookPayload.cwd === "string" ? hookPayload.cwd : process.cwd();
  const target = shellCommands(command).find((entry) => entry.words[0] === "cd" && entry.words[1])?.words[1];

  return target ? findRoot(resolve(cwd, target.replace(/^~(?=\/|$)/, homedir()))) : rootForSession(hookPayload);
}

/**
 * Add a note to the agent's context, beside the tool result. The call itself is left alone.
 *
 * @param {string} text
 */
function say(text) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
}
