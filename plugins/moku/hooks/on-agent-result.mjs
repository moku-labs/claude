#!/usr/bin/env node
/**
 * PostToolUse hook on the Agent tool: a foreground moku agent that came back without its report is named
 * to the orchestrator, with the one resume it gets. Background agents report through a hand-back prompt,
 * which the prompt hook handles the same way.
 */

import { MOKU_AGENT, RESUME_INSTRUCTION } from "../lib/hooks/agents.mjs";
import { extractContract } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const agentType = String(payload.tool_input?.subagent_type ?? "");

if (!rootForSession(payload) || !MOKU_AGENT.test(agentType)) process.exit(0);

// A background launch returns a launch notice, not a result
const response = typeof payload.tool_response === "string" ? payload.tool_response : JSON.stringify(payload.tool_response ?? "");
if (/Async agent launched|run_in_background/.test(response) && !/```json/.test(response)) process.exit(0);

if (extractContract(response)) process.exit(0);

const partial = /partial|max(imum)? turns|turn limit|maxTurns/i.test(response) ? " It stopped at its turn limit." : "";
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `moku: ${agentType} returned without its output contract.${partial} ${RESUME_INSTRUCTION}` } }));
