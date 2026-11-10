#!/usr/bin/env node
/**
 * PreToolUse hook for `moku-builder-deep`: the run's ceiling. At 300k of context or 120 tool calls (the reasons are
 * in lib/hooks/ceiling.mjs) one call is refused with the hand-back instruction, a few more are allowed to leave the
 * file in hand compiling, and then every call is refused until the agent reports `PARTIAL` with `remaining`.
 *
 * Silent for every other agent and the main thread; `MOKU_DEEP_CEILING=off` turns it off,
 * `MOKU_DEEP_CEILING_TOKENS` and `MOKU_DEEP_CEILING_STEPS` move it, `MOKU_DEEP_CEILING_DIR` keeps the counts elsewhere.
 */

import { DEEP, ceilingLimits, ceilingMessage, step } from "../lib/hooks/ceiling.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";

const { payload } = readHookInput();
const limits = ceilingLimits();

if (limits.off || !payload.agent_id || !DEEP.test(String(payload.agent_type ?? ""))) process.exit(0);

const at = step(payload, limits, process.env.MOKU_DEEP_CEILING_DIR || undefined);
if (at.state === "under" || at.state === "grace") process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ceilingMessage(at.state, at.steps, at.tokens) }
  })
);
