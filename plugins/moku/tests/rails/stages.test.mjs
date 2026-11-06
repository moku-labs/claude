import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readStages, splitSignal, weakDod } from "../../lib/rails/stages.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAILS = join(PLUGIN, "bin", "moku-rails");
const ID = "2026-11-06-friends";

const STAGES = `# Stages

| Stage | What works after it | DoD |
|---|---|---|
| 1 | W1: sinceStart is allocation-free | test "sinceStart allocates nothing" passes; no \`.slice(\` in rules.ts |
| 2 | W2: cameraOf reads a module constant | test "cameraOf returns the hoisted REVERSED array" passes |
`;

function rails(root, ...args) {
  const run = spawnSync("node", [RAILS, ...args, "--root", root, "--json"], { encoding: "utf8" });
  return JSON.parse(run.stdout || run.stderr);
}

function git(root, ...args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

/** A committed project on the rails with one open change of the given size, at the build station. */
function project(size = "M") {
  const root = mkdtempSync(join(tmpdir(), "moku-stages-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@t");
  git(root, "config", "user.name", "t");
  rails(root, "session", "start");
  writeFileSync(join(root, ".planning", "moku.md"), "type: app\nname: demo\n");
  writeFileSync(join(root, "a.ts"), "export {};\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  rails(root, "open", ID, "--size", size, "--type", "feature", "--title", "Friends");
  return root;
}

const ledger = (root) => JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8"));
const hook = (name, payload) => spawnSync("node", [join(PLUGIN, "hooks", name)], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, MOKU_HANDBACK_WAIT_MS: "0" } });

describe("stages: the offer comes on a signal of growth, never on the wording", () => {
  it("stays silent on the first scope entry: one more ask is ordinary iteration", () => {
    const root = project();

    const result = rails(root, "scope", "also show avatars");

    assert.equal(result.code, 0);
    assert.doesNotMatch(result.lines.join("\n"), /Stages offer/);
    assert.equal(ledger(root).changes[0].splitOffered, undefined);
  });

  it("offers stages, with the price, on the second scope entry", () => {
    const root = project();
    rails(root, "scope", "also show avatars");

    const result = rails(root, "scope", "and a leaderboard on the backend");
    const said = result.lines.join("\n");

    assert.equal(result.data.offer, true);
    assert.match(said, /Stages offer: .* has grown 2 times/);
    assert.match(said, /1\.6–2×/);
    assert.match(said, /smaller context/);
    assert.match(said, /a no keeps one go/);
  });

  it("offers once: a third scope entry after the offer is silent", () => {
    const root = project();
    rails(root, "scope", "one");
    rails(root, "scope", "two");

    assert.doesNotMatch(rails(root, "scope", "three").lines.join("\n"), /Stages offer/);
  });

  it("never offers stages for a quick-edit change or a change already in stages", () => {
    assert.equal(splitSignal(/** @type {any} */ ({ size: "Q", scope: ["a", "b"] })), null);
    assert.equal(splitSignal(/** @type {any} */ ({ size: "M", scope: ["a", "b"], stages: [] })), null);
    assert.equal(splitSignal(/** @type {any} */ ({ size: "S", scope: ["a", "b"] })), "scope");
    assert.equal(splitSignal(/** @type {any} */ ({ size: "M", cutoffs: 1 })), "cutoff");
  });

  it("offers stages once after a builder is cut off, and stays silent when none was", () => {
    const root = project();
    rails(root, "enter", "build");
    const contract = 'Built.\n```json\n{"agent":"moku-builder","verdict":"PASS"}\n```';
    const result = (text) => hook("on-agent-result.mjs", { cwd: root, tool_name: "Agent", tool_input: { subagent_type: "moku:moku-builder", prompt: "build" }, tool_response: text });

    assert.equal(result(contract).stdout, "");

    // Cut off: the stop hook sees the second stop with no report
    hook("on-subagent-stop.mjs", { cwd: root, agent_id: "b1", agent_type: "moku:moku-builder", stop_hook_active: true, last_assistant_message: "Still building..." });
    assert.equal(ledger(root).changes[0].cutoffs, 1);

    const offered = JSON.parse(result(contract).stdout).hookSpecificOutput.additionalContext;
    assert.match(offered, /Stages offer: a builder of .* was cut off/);
    assert.equal(result(contract).stdout, "");
  });

  it("does not take a validator that ran out of turns for a cut-off builder", () => {
    const root = project();
    rails(root, "enter", "build");

    hook("on-subagent-stop.mjs", { cwd: root, agent_id: "v1", agent_type: "moku:moku-skeptic", stop_hook_active: true, last_assistant_message: "..." });

    assert.equal(ledger(root).changes[0].cutoffs, undefined);
  });

  it("brings the offer with a background builder's hand-back", () => {
    const root = project();
    rails(root, "enter", "build");
    hook("on-subagent-stop.mjs", { cwd: root, agent_id: "b1", agent_type: "moku:moku-builder", stop_hook_active: true, last_assistant_message: "..." });

    const out = hook("on-prompt.mjs", { cwd: root, prompt: "<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n<summary>Agent \"Build\" stopped at its turn limit and produced no report</summary>\n</task-notification>" }).stdout;

    assert.match(out, /Stages offer/);
  });
});

describe("stages: each stage proves its own item", () => {
  it("calls a DoD weak when it only says the gates pass", () => {
    for (const dod of ["tests green", "bun test passes, tsc clean", "all tests pass and lint is clean", "moku-rails check tests green", "тесты зелёные"]) assert.equal(weakDod(dod), true, dod);
    for (const dod of ['test "sinceStart allocates nothing" passes', "no `.slice(` in src/plugins/timeline/rules.ts", "hidden acceptance: merge of two tier-3 tiles yields tier 4"]) assert.equal(weakDod(dod), false, dod);
  });

  it("reads the stages table and names a weak or missing DoD", () => {
    assert.deepEqual(readStages(STAGES).problems, []);

    const weak = readStages(STAGES.replace(/test "cameraOf[^|]*/, "tests green "));
    assert.match(weak.problems.join("\n"), /Stage 2's DoD "tests green" only says the gates pass/);
    assert.match(readStages("| Stage | What | DoD |\n|---|---|---|\n| 1 | all | test x y passes |").problems[0], /at least two stages/);
  });

  it("refuses stages whose DoD is only green tests, and takes good ones with the milestone", () => {
    const root = project();
    mkdirSync(join(root, ".planning", "changes", ID), { recursive: true });
    const file = join(root, ".planning", "changes", ID, "stages.md");

    writeFileSync(file, STAGES.replace(/test "cameraOf[^|]*/, "bun test green "));
    const refused = rails(root, "stages", "set", "--milestone", "timeline without garbage");
    assert.equal(refused.code, 2);
    assert.match(refused.lines.join("\n"), /only says the gates pass/);

    writeFileSync(file, STAGES);
    const taken = rails(root, "stages", "set", "--milestone", "timeline without garbage");
    assert.equal(taken.code, 0);
    assert.equal(ledger(root).milestone, "timeline without garbage");
    assert.match(taken.lines.join("\n"), /stage 1 of 2 .*DoD: test "sinceStart allocates nothing"/);
  });

  it("moves to the next stage only on a committed tree and evidence of the item", () => {
    const root = project();
    mkdirSync(join(root, ".planning", "changes", ID), { recursive: true });
    writeFileSync(join(root, ".planning", "changes", ID, "stages.md"), STAGES);
    rails(root, "stages", "set", "--milestone", "timeline without garbage");

    assert.match(rails(root, "stages", "done", "--evidence", "all tests green").lines[0], /only says the gates pass/);

    writeFileSync(join(root, "a.ts"), "export const x = 1;\n");
    assert.match(rails(root, "stages", "done", "--evidence", 'test "sinceStart allocates nothing" passes').lines[0], /uncommitted work/);

    git(root, "commit", "-qam", "stage 1");
    const first = rails(root, "stages", "done", "--evidence", 'test "sinceStart allocates nothing" passes; grep .slice( finds nothing');
    assert.equal(first.code, 0);
    assert.equal(first.data.next, 2);
    assert.match(first.lines[1], /stage 2 of 2/);

    // The change does not close while a stage is open
    const close = rails(root, "close");
    assert.equal(close.code, 2);
    assert.match(close.lines[0], /Stage 2 of 2/);

    const last = rails(root, "stages", "done", "--evidence", 'test "cameraOf returns the hoisted REVERSED array" passes');
    assert.equal(last.data.next, null);
    assert.equal(ledger(root).milestone, null);
    assert.match(rails(root, "status").lines.join("\n"), /all 2 stages .* are done/);
  });
});
