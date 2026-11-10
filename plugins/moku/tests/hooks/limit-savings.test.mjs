import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { agentTranscript, ceilingLimits, step } from "../../lib/hooks/ceiling.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const COUNTS = mkdtempSync(join(tmpdir(), "moku-ceiling-counts-"));

function hook(name, payload, env = {}) {
  const run = spawnSync("node", [join(PLUGIN, "hooks", name)], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, MOKU_DEEP_CEILING_DIR: COUNTS, ...env } });
  return { code: run.status, out: run.stdout };
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "moku-limit-"));
  spawnSync("node", [join(PLUGIN, "bin", "moku-rails"), "session", "start", "--root", root], { encoding: "utf8" });
  return root;
}

/** A session transcript with one subagent transcript whose newest call carried `tokens` of context. */
function sessionWithAgent(agentId, tokens) {
  const dir = mkdtempSync(join(tmpdir(), "moku-ceiling-"));
  const main = join(dir, "s1.jsonl");
  writeFileSync(main, "");
  mkdirSync(join(dir, "s1", "subagents"), { recursive: true });
  const call = { type: "assistant", isSidechain: true, message: { id: "m1", usage: { input_tokens: 5, cache_read_input_tokens: tokens - 5 } } };
  writeFileSync(join(dir, "s1", "subagents", `agent-${agentId}.jsonl`), `${JSON.stringify(call)}\n`);
  return { dir, main };
}

const deep = (agentId, main) => ({ session_id: "s1", agent_id: agentId, agent_type: "moku:moku-builder-deep", tool_name: "Read", tool_input: {}, transcript_path: main });

describe("the deep builder's ceiling", () => {
  it("finds the agent's own transcript next to the session's", () => {
    const { dir, main } = sessionWithAgent("a7", 1000);
    assert.equal(agentTranscript(deep("a7", main)), join(dir, "s1", "subagents", "agent-a7.jsonl"));
    assert.equal(agentTranscript({ transcript_path: join(dir, "agent-x.jsonl") }), join(dir, "agent-x.jsonl"));
  });

  it("defaults to 300k and 120, follows positive overrides and the off switch", () => {
    assert.deepEqual(ceilingLimits({}), { tokens: 300_000, steps: 120, off: false });
    assert.deepEqual(ceilingLimits({ MOKU_DEEP_CEILING_STEPS: "80", MOKU_DEEP_CEILING_TOKENS: "nope" }), { tokens: 300_000, steps: 80, off: false });
    assert.equal(ceilingLimits({ MOKU_DEEP_CEILING: "off" }).off, true);
  });

  it("counts calls per agent: under, then one warning, the grace calls, then over", () => {
    const { main } = sessionWithAgent("a8", 1000);
    const state = mkdtempSync(join(tmpdir(), "moku-ceiling-state-"));
    const seen = [];
    for (let i = 0; i < 12; i++) seen.push(step(deep("a8", main), { tokens: 300_000, steps: 4 }, state).state);

    assert.deepEqual(seen, ["under", "under", "under", "warn", "grace", "grace", "grace", "grace", "grace", "grace", "over", "over"]);
    assert.equal(step(deep("a9", main), { tokens: 300_000, steps: 4 }, state).state, "under");
  });

  it("stops at the context ceiling on the first call", () => {
    const { main } = sessionWithAgent("b1", 320_000);
    const state = mkdtempSync(join(tmpdir(), "moku-ceiling-state-"));
    const at = step(deep("b1", main), { tokens: 300_000, steps: 120 }, state);
    assert.equal(at.state, "warn");
    assert.equal(at.tokens, 320_000);
  });

  it("refuses the call with the hand-back instruction, and leaves every other agent alone", () => {
    const id = `deep-${process.pid}-${Date.now()}`;
    const big = sessionWithAgent(id, 350_000);

    const refused = JSON.parse(hook("on-deep-ceiling.mjs", deep(id, big.main)).out).hookSpecificOutput;
    assert.equal(refused.permissionDecision, "deny");
    assert.match(refused.permissionDecisionReason, /about 350k tokens/);
    assert.match(refused.permissionDecisionReason, /"verdict": "PARTIAL"/);
    assert.match(refused.permissionDecisionReason, /remaining/);

    assert.equal(hook("on-deep-ceiling.mjs", { ...deep(`${id}-b`, big.main), agent_type: "moku:moku-builder" }).out, "");
    assert.equal(hook("on-deep-ceiling.mjs", { ...deep(`${id}-c`, big.main), agent_id: undefined }).out, "");
    assert.equal(hook("on-deep-ceiling.mjs", deep(`${id}-d`, big.main), { MOKU_DEEP_CEILING: "off" }).out, "");
  });
});

describe("a batch of agent reports wakes the session once for real work", () => {
  const notification = "[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification>\n<status>completed</status>\n<summary>Agent \"builder\" finished</summary>\n</task-notification>";

  it("asks for one short line while other agents of the session still run", () => {
    const root = project();
    hook("on-subagent-start.mjs", { cwd: root, session_id: "s1", agent_id: "b2", agent_type: "moku:moku-builder" });

    const out = hook("on-prompt.mjs", { cwd: root, session_id: "s1", prompt: notification }).out;
    assert.match(out, /one of a batch, and 1 agent\(s\) running: moku:moku-builder/);
    assert.match(out, /no tool calls/);
  });

  it("says nothing for the last report, for another session's agents, and for a hand-back with no report", () => {
    const root = project();
    assert.equal(hook("on-prompt.mjs", { cwd: root, session_id: "s1", prompt: notification }).out, "");

    hook("on-subagent-start.mjs", { cwd: root, session_id: "s2", agent_id: "b3", agent_type: "moku:moku-builder" });
    assert.equal(hook("on-prompt.mjs", { cwd: root, session_id: "s1", prompt: notification }).out, "");

    const silent = hook("on-prompt.mjs", { cwd: root, session_id: "s2", prompt: `${notification}\nThe agent produced no report.` }).out;
    assert.doesNotMatch(silent, /one of a batch/);
  });
});

describe("a closed change offers a new session", () => {
  it("offers the next task in a new session and this one to the archive, at any context size", () => {
    const root = project();
    const payload = { cwd: root, session_id: "s1", tool_name: "Bash", tool_input: { command: "moku-rails close" } };

    const context = JSON.parse(hook("on-station-done.mjs", payload).out).hookSpecificOutput.additionalContext;
    assert.match(context, /new session/);
    assert.match(context, /archive this one/);
    assert.match(context, /moku-rails status/);
    assert.equal(hook("on-station-done.mjs", { ...payload, agent_id: "a1" }).out, "");
  });
});
