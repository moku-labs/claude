#!/usr/bin/env node
/**
 * PostToolUse hook on Bash: after `moku-rails done <station>` or `moku-rails close` succeeded, a long conversation
 * gets one line that offers `/compact`. A station boundary is the natural point: the station's work is in
 * `.planning/`, the compaction hooks carry the standing over, and every later call stops paying for the old turns.
 * After `moku-rails close` it always offers more: the next task in a new session, and this one to the archive. A closed
 * change is the cheapest point to leave a conversation: everything it decided is in `.planning/`, and a session that
 * lives on for the next task re-reads the old context on every call and every wake-up after a pause.
 * Silent off the rails, in a subagent, for any other command, and (after `done`) while the context is under the
 * threshold.
 */

import { compactThreshold, lastContextTokens } from "../lib/hooks/context.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const BOUNDARY = /(^|[\s;&|(])moku-rails\s+(done|close)\b/;
const CLOSE = /(^|[\s;&|(])moku-rails\s+close\b/;

const { payload } = readHookInput();
const line = payload.tool_input?.command;

if (typeof line !== "string" || !BOUNDARY.test(line) || railsMode() === "off" || payload.agent_id) process.exit(0);
if (!rootForSession(payload)) process.exit(0);

const tokens = lastContextTokens(payload.transcript_path);
const k = tokens ? Math.round(tokens / 1000) : undefined;

if (CLOSE.test(line)) {
  const size = k ? `This conversation carries about ${k}k tokens of context` : "This conversation's context";
  const text = `moku: the change is closed. ${size}, and if the next task is done here, every call and every wake-up after a pause pays for all of it again; a new session starts from \`moku-rails status\` and .planning/, which hold everything this change decided. In one sentence, offer the person to take the next task (an idea from \`moku-rails status\`, or what they say next) to a new session and to archive this one. On a yes in the Code tab: start the new session with a short brief (the project folder, the next task, "start with \`moku-rails status\`"), then archive this session; elsewhere: they open a new session, or type \`/clear\` here. Do not carry the old conversation into the brief. On a no, carry on here and do not offer it again before the next close.`;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } }));
  process.exit(0);
}

if (!tokens || tokens <= compactThreshold()) process.exit(0);

const text = `moku: this conversation carries about ${k}k tokens of context, and every call pays for all of it. The station is done, so this is the point to compact: in one sentence offer the person to type \`/compact\` before the next station (the change's state lives in .planning/ and comes back after it). You cannot run it yourself. On a no, carry on and do not offer it again before the next station.`;
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } }));
