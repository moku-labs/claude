/**
 * The ceiling of `moku-builder-deep`: how far one deep run may grow before it hands back what it did and what is
 * left, so a fresh builder finishes the rest on a small context.
 *
 * Why these numbers (week of 2026-11-07, research/token-efficiency): a deep run averaged 203 calls and peaked at
 * 624k of context, $56 at API prices, 26 % of the week's limit. Every call re-reads the whole context, so the
 * cost of a run grows with the square of its length; replaying the real series with a restart at 300k cut the
 * deep cache reads by half (cap_sim: 200k saves 58 % with twice the restarts, 400k only 40 %). 120 calls is the
 * same point counted in steps (about 2.5k of context per call), and 1.7 times the 70 turns a Complex plugin is
 * expected to take, so a healthy run never meets it.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { lastContextTokens } from "./context.mjs";

export const DEEP = /(^|:)moku-builder-deep$/;
export const CEILING_TOKENS = 300_000;
export const CEILING_STEPS = 120;
/** Tool calls left after the warning, to leave the file in hand compiling and write the report. */
export const GRACE_STEPS = 6;

/**
 * The limits in force: the environment overrides when they are positive numbers, else the defaults.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ tokens: number, steps: number, off: boolean }}
 * @example
 * ceilingLimits({ MOKU_DEEP_CEILING_STEPS: "80" }); // { tokens: 300000, steps: 80, off: false }
 */
export function ceilingLimits(env = process.env) {
  const positive = (/** @type {string | undefined} */ value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };

  return {
    tokens: positive(env.MOKU_DEEP_CEILING_TOKENS, CEILING_TOKENS),
    steps: positive(env.MOKU_DEEP_CEILING_STEPS, CEILING_STEPS),
    off: String(env.MOKU_DEEP_CEILING ?? "").toLowerCase() === "off"
  };
}

/**
 * The agent's own transcript. The harness may name it, or give the session's: then it sits at
 * `<session dir>/<session id>/subagents/agent-<agent id>.jsonl`.
 *
 * @param {Record<string, any>} payload PreToolUse payload from inside a subagent
 * @returns {string | undefined}
 * @example
 * agentTranscript({ transcript_path: "/p/s1.jsonl", session_id: "s1", agent_id: "a7" }); // "/p/s1/subagents/agent-a7.jsonl"
 */
export function agentTranscript(payload) {
  if (typeof payload.agent_transcript_path === "string" && existsSync(payload.agent_transcript_path)) return payload.agent_transcript_path;

  const main = payload.transcript_path;
  if (typeof main !== "string" || !main) return undefined;
  if (basename(main).startsWith("agent-")) return main;

  const dir = join(dirname(main), String(payload.session_id ?? basename(main, ".jsonl")), "subagents");
  const named = join(dir, `agent-${payload.agent_id}.jsonl`);
  if (existsSync(named)) return named;

  try {
    const match = readdirSync(dir).find((file) => file.endsWith(".jsonl") && file.includes(String(payload.agent_id)));
    return match ? join(dir, match) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Counts one more tool call of the agent and answers where it stands. The count lives in a small file per agent
 * id, so a resumed agent keeps its count and a fresh spawn starts at zero.
 *
 * @param {Record<string, any>} payload PreToolUse payload from inside a subagent
 * @param {{ tokens: number, steps: number }} limits
 * @param {string} [stateDir] where the counts live
 * @returns {{ state: "under" | "warn" | "grace" | "over", steps: number, tokens: number | undefined }}
 * @example
 * step({ agent_id: "a7", transcript_path: "/p/s1.jsonl" }, { tokens: 300000, steps: 120 }); // { state: "under", steps: 1, tokens: … }
 */
export function step(payload, limits, stateDir = tmpdir()) {
  const file = join(stateDir, `moku-deep-ceiling-${String(payload.agent_id).replace(/[^\w.-]/g, "_")}.json`);
  let saved = { steps: 0, warnedAt: 0 };
  try {
    saved = { ...saved, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    /* the first call of this agent */
  }

  const steps = saved.steps + 1;
  const tokens = lastContextTokens(agentTranscript(payload), { sidechain: true });
  const reached = steps >= limits.steps || (tokens ?? 0) >= limits.tokens;

  let state = "under";
  if (saved.warnedAt > 0) state = steps - saved.warnedAt > GRACE_STEPS ? "over" : "grace";
  else if (reached) state = "warn";

  const warnedAt = state === "warn" ? steps : saved.warnedAt;
  try {
    writeFileSync(file, JSON.stringify({ steps, warnedAt }));
  } catch {
    /* without the file the count restarts: the ceiling comes later, never wrongly early */
  }

  return { state: /** @type {any} */ (state), steps, tokens };
}

/**
 * What the agent reads when its call is refused at the ceiling.
 *
 * @param {"warn" | "over"} state
 * @param {number} steps
 * @param {number | undefined} tokens
 * @returns {string}
 */
export function ceilingMessage(state, steps, tokens) {
  const where = `${steps} tool calls${tokens ? `, about ${Math.round(tokens / 1000)}k tokens of context` : ""}`;
  const report =
    'Deliver the output contract with `"verdict": "PARTIAL"`, `"ceiling": true`, `done` (each file and behaviour that is green) and `remaining` (each file, behaviour or failing test still open, with the next step for it). The orchestrator hands `remaining` to a fresh builder on a small context; nothing you leave is lost.';
  if (state === "warn") {
    return `moku: the deep builder's ceiling is reached (${where}). Start no new work: no new test, no new file, no new check. You have ${GRACE_STEPS} tool calls to leave the file in hand compiling. Then stop. ${report} This call was refused; repeat it only if the file in hand needs it.`;
  }
  return `moku: the deep builder's ceiling is reached (${where}) and the grace calls are used. No more tools. ${report}`;
}
