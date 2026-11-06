#!/usr/bin/env node
/**
 * PostToolUse hook on Bash: after `moku-rails done <station>` or `moku-rails close` succeeded, a long conversation
 * gets one line that offers `/compact`. A station boundary is the natural point: the station's work is in
 * `.planning/`, the compaction hooks carry the standing over, and every later call stops paying for the old turns.
 * Silent off the rails, in a subagent, for any other command, and while the context is under the threshold.
 */

import { compactThreshold, lastContextTokens } from "../lib/hooks/context.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const BOUNDARY = /(^|[\s;&|(])moku-rails\s+(done|close)\b/;

const { payload } = readHookInput();
const line = payload.tool_input?.command;

if (typeof line !== "string" || !BOUNDARY.test(line) || railsMode() === "off" || payload.agent_id) process.exit(0);
if (!rootForSession(payload)) process.exit(0);

const tokens = lastContextTokens(payload.transcript_path);
if (!tokens || tokens <= compactThreshold()) process.exit(0);

const k = Math.round(tokens / 1000);
const text = `moku: this conversation carries about ${k}k tokens of context, and every call pays for all of it. The station is done, so this is the point to compact: in one sentence offer the person to type \`/compact\` before the next station (the change's state lives in .planning/ and comes back after it). You cannot run it yourself. On a no, carry on and do not offer it again before the next station.`;
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } }));
