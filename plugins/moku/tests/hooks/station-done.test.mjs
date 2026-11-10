import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { compactThreshold, lastContextTokens } from "../../lib/hooks/context.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function hook(payload, env = {}) {
  const run = spawnSync("node", [join(PLUGIN, "hooks", "on-station-done.mjs")], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, ...env } });
  return { code: run.status, out: run.stdout };
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "moku-station-done-"));
  spawnSync("node", [join(PLUGIN, "bin", "moku-rails"), "session", "start", "--root", root], { encoding: "utf8" });
  return root;
}

/** A transcript whose newest main-thread call carried `tokens` of context, with a sidechain call after it. */
function transcript(root, tokens) {
  const file = join(root, "t.jsonl");
  const call = (usage, extra = {}) => JSON.stringify({ type: "assistant", message: { id: String(Math.random()), usage }, ...extra });
  writeFileSync(file, `${call({ input_tokens: 10, cache_read_input_tokens: 1000 })}\n{"type":"user","message":{"content":"x"}}\n`);
  appendFileSync(file, `${call({ input_tokens: 5, cache_read_input_tokens: tokens - 1005, cache_creation_input_tokens: 1000 })}\n`);
  appendFileSync(file, `${call({ input_tokens: 1, cache_read_input_tokens: 10 }, { isSidechain: true })}\n{"type":"attachment"}\n`);
  return file;
}

const done = (root, file, command = "moku-rails done build") => ({ cwd: root, session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, transcript_path: file });

describe("context of the conversation", () => {
  it("reads the newest main-thread call from the tail, past sidechain calls and other lines", () => {
    const root = mkdtempSync(join(tmpdir(), "moku-context-"));
    assert.equal(lastContextTokens(transcript(root, 452_000)), 452_000);
  });

  it("answers undefined for a missing file, no path or no usage", () => {
    const root = mkdtempSync(join(tmpdir(), "moku-context-"));
    writeFileSync(join(root, "empty.jsonl"), '{"type":"user"}\n');
    assert.equal(lastContextTokens(join(root, "nope.jsonl")), undefined);
    assert.equal(lastContextTokens(undefined), undefined);
    assert.equal(lastContextTokens(join(root, "empty.jsonl")), undefined);
  });

  it("takes a positive override of the threshold and ignores anything else", () => {
    assert.equal(compactThreshold({ MOKU_COMPACT_HINT_TOKENS: "300000" }), 300_000);
    assert.equal(compactThreshold({ MOKU_COMPACT_HINT_TOKENS: "lots" }), 400_000);
    assert.equal(compactThreshold({}), 400_000);
  });
});

describe("compact hint at a station boundary", () => {
  it("offers /compact after `moku-rails done` once the context is over the threshold", () => {
    const root = project();
    const result = hook(done(root, transcript(root, 452_000)));

    const context = JSON.parse(result.out).hookSpecificOutput.additionalContext;
    assert.match(context, /about 452k tokens/);
    assert.match(context, /`\/compact`/);
  });

  it("offers a new session after `moku-rails close` instead, with the context size", () => {
    const root = project();
    const out = hook(done(root, transcript(root, 500_000), "moku-rails close --change 2026-11-05-x")).out;
    assert.match(out, /about 500k tokens/);
    assert.match(out, /new session/);
  });

  it("stays silent under the threshold, for other commands, in a subagent and off the rails", () => {
    const root = project();
    const big = transcript(root, 452_000);

    assert.equal(hook(done(root, transcript(root, 399_000))).out, "");
    assert.equal(hook(done(root, big, "moku-rails status")).out, "");
    assert.equal(hook(done(root, big, "echo moku-rails-done")).out, "");
    assert.equal(hook({ ...done(root, big), agent_id: "a1" }).out, "");
    assert.equal(hook(done(root, big), { CLAUDE_PLUGIN_OPTION_RAILS: "off" }).out, "");

    const elsewhere = mkdtempSync(join(tmpdir(), "moku-off-"));
    assert.equal(hook({ ...done(elsewhere, big), session_id: "s-off" }).out, "");
  });

  it("follows the threshold override", () => {
    const root = project();
    assert.match(hook(done(root, transcript(root, 320_000)), { MOKU_COMPACT_HINT_TOKENS: "300000" }).out, /about 320k/);
  });

  it("is registered after Bash calls in hooks.json", () => {
    const hooks = JSON.parse(readFileSync(join(PLUGIN, "hooks", "hooks.json"), "utf8")).hooks.PostToolUse;
    const bash = hooks.find((entry) => entry.matcher === "Bash");
    assert.ok(bash.hooks.some((h) => h.command.endsWith("/hooks/on-station-done.mjs")));
  });
});
