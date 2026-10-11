#!/usr/bin/env node
/**
 * PostToolUseFailure hook on the Agent tool: a moku agent that could not start is named to the
 * orchestrator, with the one retry it gets, and the record its start left behind is dropped.
 *
 * A launch error (a permission check on a preloaded skill, an unknown agent type, a model that is not
 * available) ends the agent before its first turn. `SubagentStart` has already recorded it and
 * `SubagentStop` never comes, so without this hook `moku-rails status` keeps naming it as running.
 * An interrupt by the person is not a launch failure and prints nothing.
 */

import { LAUNCH_FAILURE_INSTRUCTION, MOKU_AGENT, forgetFailedLaunch } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentType = String(payload.tool_input?.subagent_type ?? "");

if (!root || !MOKU_AGENT.test(agentType)) process.exit(0);

forgetFailedLaunch(root, { type: agentType, session: payload.session_id });

if (payload.is_interrupt === true) process.exit(0);

const error = String(payload.error ?? "").trim();
const said = error ? ` The error: ${error}` : "";
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUseFailure", additionalContext: `moku: ${agentType} could not start.${said} ${LAUNCH_FAILURE_INSTRUCTION}` } }));
