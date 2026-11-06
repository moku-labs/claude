#!/usr/bin/env node
/**
 * SubagentStop hook: every moku agent ends with a report, and its outcome lands in `.planning/build/agent-log.md`.
 *
 * An agent that stops without the output contract is told once, through the stop decision, to deliver its
 * report now (the hook's `reason` is the agent's next instruction). A report handed back through the
 * `SubagentHandback` tool is read from the transcript: it is not in the agent's last message. If it stops a second time without one,
 * the log says so and names whether the turn limit was hit, and the person sees the resume instruction.
 * The status skill reads the log. Silent outside projects with planning state. A builder cut off (at its turn
 * limit, or with no report after the reminder) is noted on the open change, so the conductor offers stages once.
 *
 * The harness can run this hook before the hand-back reaches the transcript file, so an unseen hand-back
 * is looked for again for up to a second before the agent is blocked. Each block that still happens leaves
 * one line in `.planning/build/stop-diagnostics.jsonl`: the payload's keys and the transcript's size, never
 * its content. That log is temporary, until the cause of the remaining blocks is known.
 */

import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { MOKU_AGENT, RESUME_INSTRUCTION, forgetAgent, handedBack, turnBudget } from "../lib/hooks/agents.mjs";
import { extractContract, summarize } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { EXECUTOR, recordCutoff } from "../lib/rails/stages.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentType = String(payload.agent_type ?? "");
const agentId = String(payload.agent_id ?? "");

if (!root || !MOKU_AGENT.test(agentType)) process.exit(0);

// The agent is no longer running, whatever it reported
if (agentId) forgetAgent(root, agentId);

// The report is the agent's last message, or what it handed back through SubagentHandback in this run
const transcriptAtStop = transcriptSize(payload.agent_transcript_path);
const contract = extractContract(String(payload.last_assistant_message ?? "")) ?? handedBackContract(payload.agent_transcript_path);

// No report yet, first stop: the agent gets one instruction to deliver it before it ends
if (!contract && payload.stop_hook_active !== true) {
  logBlock();
  console.log(JSON.stringify({ decision: "block", reason: "You are ending without your report. Deliver it now: the output contract (fenced json) with an honest verdict on what is done and what is not. Report the work you have done and start no new work of your own. An assignment from the coordinator that arrived since still stands: do it, then report on it too." }));
  process.exit(0);
}

// A builder cut off (at its turn limit, or ended twice without its report) is a signal for stages: the
// conductor offers them with the result
if (EXECUTOR.test(agentType) && (!contract || turnBudget(payload).hitLimit)) recordCutoff(root);

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
 * The contract of a hand-back in the agent's transcript, looked for again for up to `MOKU_HANDBACK_WAIT_MS`
 * (a second by default) while the transcript exists and shows none. In real runs 95% of blocked stops had
 * a valid contract in the file afterwards: the hook had read it before the hand-back was written.
 *
 * @param {unknown} transcriptPath
 * @returns {import("../lib/hooks/contract.mjs").Contract | undefined}
 */
function handedBackContract(transcriptPath) {
  const deadline = Date.now() + Number(process.env.MOKU_HANDBACK_WAIT_MS ?? 1000);
  for (;;) {
    const contract = extractContract(handedBack(transcriptPath));
    if (contract || Date.now() >= deadline || typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return contract;

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}

/**
 * One diagnostic line for a blocked stop: what the payload carried and how big the transcript was, no content.
 */
function logBlock() {
  try {
    const dir = join(root, ".planning", "build");
    mkdirSync(dir, { recursive: true });
    const line = {
      time: new Date().toISOString(),
      agentType,
      keys: Object.keys(payload).sort(),
      lastMessageChars: String(payload.last_assistant_message ?? "").length,
      transcriptAtStop,
      transcriptAtBlock: transcriptSize(payload.agent_transcript_path),
      handBackSeen: handedBack(payload.agent_transcript_path) !== "",
    };
    appendFileSync(join(dir, "stop-diagnostics.jsonl"), `${JSON.stringify(line)}\n`);
  } catch {
    /* a diagnostic never fails the hook */
  }
}

/**
 * @param {unknown} transcriptPath
 * @returns {number | null} bytes, or null when there is no readable transcript
 */
function transcriptSize(transcriptPath) {
  try {
    return typeof transcriptPath === "string" ? statSync(transcriptPath).size : null;
  } catch {
    return null;
  }
}

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
