#!/usr/bin/env node
/**
 * SubagentStop hook: every moku agent ends with a report, and its outcome lands in `.planning/build/agent-log.md`.
 *
 * An agent that stops without the output contract is told once, through the stop decision, to deliver its
 * report now (the hook's `reason` is the agent's next instruction). If it stops a second time without one,
 * the log says so and names whether the turn limit was hit, and the person sees the resume instruction.
 * The status skill reads the log. Silent outside projects with planning state.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { MOKU_AGENT, RESUME_INSTRUCTION, forgetAgent, turnBudget } from "../lib/hooks/agents.mjs";
import { extractContract, summarize } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentType = String(payload.agent_type ?? "");
const agentId = String(payload.agent_id ?? "");

if (!root || !MOKU_AGENT.test(agentType)) process.exit(0);

// The agent is no longer running, whatever it reported
if (agentId) forgetAgent(root, agentId);

const contract = extractContract(String(payload.last_assistant_message ?? ""));

// No report yet, first stop: the agent gets one instruction to deliver it before it ends
if (!contract && payload.stop_hook_active !== true) {
  console.log(JSON.stringify({ decision: "block", reason: "You are ending without your report. Deliver it now: the output contract (fenced json) with an honest verdict on what is done and what is not. Do no more work." }));
  process.exit(0);
}

if (!existsSync(join(root, ".planning", "STATE.md"))) process.exit(0);

// One table row per completion
const logFile = join(root, ".planning", "build", "agent-log.md");
const header = existsSync(logFile) ? "" : "| Time | Agent | Outcome |\n|---|---|---|\n";
const outcome = contract ? summarize(contract) : noReportOutcome();
const time = new Date().toISOString().replace("T", " ").slice(0, 19);

mkdirSync(join(root, ".planning", "build"), { recursive: true });
appendFileSync(logFile, `${header}| ${time} | ${agentType} | ${outcome} |\n`);

// Still no report after the reminder: the person sees what the orchestrator must do
if (!contract) console.log(JSON.stringify({ systemMessage: `moku: ${agentType} ${outcome}. ${RESUME_INSTRUCTION}` }));

/**
 * `no report (turn limit: 150/150)` or `no report (ended at 12 of 40 turns)`.
 *
 * @returns {string}
 */
function noReportOutcome() {
  const { limit, used, hitLimit } = turnBudget(payload);
  if (hitLimit) return `no report (turn limit: ${used}/${limit})`;
  if (used !== undefined && limit !== undefined) return `no report (ended at ${used} of ${limit} turns)`;

  return "no report";
}
