#!/usr/bin/env node
/**
 * SubagentStart hook: record that a moku agent is running inside this project.
 *
 * `status` names them, `moku-rails pause` warns about them, and the stop hook lets a turn end while they run.
 * The SubagentStop hook removes the record.
 * Silent off the rails and for agents that are not moku's.
 */

import { MOKU_AGENT, registerAgent } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentType = String(payload.agent_type ?? "");
const agentId = String(payload.agent_id ?? "");

if (!root || !agentId || !MOKU_AGENT.test(agentType)) process.exit(0);

registerAgent(root, { id: agentId, type: agentType });
