#!/usr/bin/env node
/**
 * PostToolUse hook on the Agent tool: a foreground moku agent that came back without its report is named
 * to the orchestrator, with the one resume it gets.
 *
 * The harness passes the tool response as an object. A background launch (`status: "async_launched"`) has
 * no result yet, and a report sent through the hand-back (`handback: "send"`) is not in the response: both
 * arrive later as a hand-back prompt, which the prompt hook handles the same way. Only the text of a
 * finished call is read for the contract, never the whole object, whose `prompt` is the orchestrator's words.
 */

import { MOKU_AGENT, RESUME_INSTRUCTION } from "../lib/hooks/agents.mjs";
import { extractContract } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const LAUNCH_TEXT = /Async agent launched|agent is working in the background|will be notified automatically|delivered to you as a message from/i;
const TURN_LIMIT = /partial|max(imum)? turns|turn limit|maxTurns/i;

const { payload } = readHookInput();
const agentType = String(payload.tool_input?.subagent_type ?? "");

if (!rootForSession(payload) || !MOKU_AGENT.test(agentType)) process.exit(0);

// A launch or a hand-back pointer is not the agent's result: the report comes later as a hand-back prompt
const response = payload.tool_response;
if (payload.tool_input?.run_in_background === true || isLaunch(response) || response?.handback === "send") process.exit(0);

// The text of a finished call: its contract, or the launch notice when the response is plain text
const report = reportText(response);
if (extractContract(report) || LAUNCH_TEXT.test(report)) process.exit(0);

const partial = TURN_LIMIT.test(report) ? " It stopped at its turn limit." : "";
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `moku: ${agentType} returned without its output contract.${partial} ${RESUME_INSTRUCTION}` } }));

/**
 * True for a background launch: the harness marks it async, or it returns an agent id or output file
 * and no content.
 *
 * @param {unknown} value the Agent tool response
 * @returns {boolean}
 */
function isLaunch(value) {
  if (!value || typeof value !== "object") return false;
  if (value.status === "async_launched" || value.isAsync === true) return true;

  return Boolean(value.agentId || value.outputFile) && value.content === undefined;
}

/**
 * The agent's own words: the response when it is text, its text blocks when it is a block list or an
 * object with `content`.
 *
 * @param {unknown} value the Agent tool response
 * @returns {string}
 */
function reportText(value) {
  if (typeof value === "string") return value;
  if (typeof value?.content === "string") return value.content;

  const blocks = Array.isArray(value) ? value : value?.content;
  if (!Array.isArray(blocks)) return "";

  return blocks.filter((block) => block?.type === "text").map((block) => String(block.text ?? "")).join("\n");
}
