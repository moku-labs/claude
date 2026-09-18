#!/usr/bin/env node
/**
 * SubagentStop hook: append each moku agent's outcome to `.planning/build/agent-log.md`.
 *
 * The status skill reads this log. Silent outside projects with planning state.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { extractContract, summarize } from "../lib/hooks/contract.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";

const { payload } = readHookInput();
const root = payload.cwd ?? process.cwd();
const agentType = String(payload.agent_type ?? "");

// Only moku agents, plain or plugin-qualified (`moku:moku-builder`, `moku-web:moku-web-validator`)
const isMokuAgent = /(^|:)(moku-|design-generator|brainstorm-challenger)/.test(agentType);
if (!isMokuAgent || !existsSync(join(root, ".planning", "STATE.md"))) process.exit(0);

// One table row per completion
const logFile = join(root, ".planning", "build", "agent-log.md");
const header = existsSync(logFile) ? "" : "| Time | Agent | Outcome |\n|---|---|---|\n";
const outcome = summarize(extractContract(String(payload.last_assistant_message ?? "")));
const time = new Date().toISOString().replace("T", " ").slice(0, 19);

mkdirSync(join(root, ".planning", "build"), { recursive: true });
appendFileSync(logFile, `${header}| ${time} | ${agentType} | ${outcome} |\n`);
