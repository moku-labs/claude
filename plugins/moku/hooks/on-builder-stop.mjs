#!/usr/bin/env node
/**
 * SubagentStop hook for `moku-builder` and `moku-builder-deep`: a PASS is checked, not trusted.
 *
 * When a builder ends with a report that says PASS, this hook runs the project's `tsc --noEmit` and the tests of
 * the builder's unit (its plugin or feature folder, or the files of its report). Type errors outside the unit, and
 * errors the tree already had before the builder started (the baseline `on-builder-start.mjs` took), are not the
 * builder's and are left out. Anything left blocks the builder once, with only what failed, cut short. A second
 * stop is never blocked: the person sees what is still failing and the orchestrator's own run decides.
 *
 * A stop without a report is `on-subagent-stop.mjs`'s business (it blocks once for the report); this hook stays
 * out of it. A FAIL report is not checked: the builder said itself that it is not done. `MOKU_BUILDER_CHECK=off`
 * turns the hook off.
 */

import { BUILDER, baselineFileOf, blockReason, blockedBefore, changedFileErrors, forgetBuilder, inScope, logCheck, newErrors, readBaseline, runTests, runTsc, unitScope } from "../lib/hooks/builder-check.mjs";
import { handedBack } from "../lib/hooks/agents.mjs";
import { extractContract } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentType = String(payload.agent_type ?? "");
const agentId = String(payload.agent_id ?? "");

if (!root || !agentId || !BUILDER.test(agentType) || process.env.MOKU_BUILDER_CHECK === "off") process.exit(0);

const contract = extractContract(String(payload.last_assistant_message ?? "")) ?? extractContract(handedBack(payload.agent_transcript_path));
if (!contract) process.exit(0);

const scope = unitScope(root, contract);
if (String(contract.verdict ?? "").toUpperCase() !== "PASS" || !scope) {
  logCheck(root, { agentType, agentId, verdict: contract.verdict ?? null, scope: scope ?? null, checked: false, baselineFile: baselineFileOf(root, agentId) ?? null });
  forgetBuilder(root, agentId);
  process.exit(0);
}

// Type errors in the unit that the tree did not have before the builder started
const started = Date.now();
const current = runTsc(root)?.filter((error) => inScope(scope, error.file));
const baseline = current && current.length > 0 ? readBaseline(root, agentId, scope) : undefined;
const errors = !current || current.length === 0 ? [] : baseline ? newErrors(current, baseline.errors.filter((error) => inScope(scope, error.file))) : changedFileErrors(root, current);

// The unit's tests; a delta whose suite was red before the builder is not held to green
const tests = contract.tests?.preexistingGreen === false ? undefined : runTests(root, scope);
const failures = tests?.failures ?? [];

const failed = errors.length > 0 || failures.length > 0;
const again = blockedBefore(root, agentId, failed);
logCheck(root, {
  agentType,
  agentId,
  verdict: "PASS",
  scope,
  checked: true,
  tsc: current ? { newErrors: errors.length, baseline: current.length === 0 ? "not needed" : baseline ? baseline.file : "git" } : "none",
  tests: tests ? { runner: tests.runner, failing: failures.length } : "none",
  seconds: Math.round((Date.now() - started) / 1000),
  blocked: failed && !again,
  stillFailing: failed && again,
  baselineFile: baseline?.file ?? baselineFileOf(root, agentId) ?? null,
});

if (!failed) {
  forgetBuilder(root, agentId);
  process.exit(0);
}

// Blocked once already: the builder is not stopped again, the person sees what is still failing
if (again) {
  forgetBuilder(root, agentId);
  const what = [errors.length > 0 ? `${errors.length} new tsc error${errors.length === 1 ? "" : "s"}` : "", failures.length > 0 ? `${failures.length} failing test${failures.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
  console.log(JSON.stringify({ systemMessage: `moku: ${agentType} reported PASS, but its unit (${[...scope.dirs, ...scope.files].join(", ")}) still has ${what}. Treat the build as FAIL until the orchestrator's own check is green.` }));
  process.exit(0);
}

console.log(JSON.stringify({ decision: "block", reason: blockReason(scope, errors, failures) }));
