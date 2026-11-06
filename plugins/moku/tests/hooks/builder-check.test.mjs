import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { blockReason, newErrors, parseTsc, unitScope } from "../../lib/hooks/builder-check.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAILS = join(PLUGIN, "bin", "moku-rails");
const CHECKS = join(".planning", "build", "builder-checks");

/** Run a hook script with a JSON payload on stdin. */
function hook(name, payload, env = {}) {
  const run = spawnSync("node", [join(PLUGIN, "hooks", name)], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, MOKU_HANDBACK_WAIT_MS: "0", MOKU_BASELINE_WAIT_MS: "5000", ...env } });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

/**
 * A project on the rails with a fake `tsc` and a fake `vitest`: `tsc` prints `tsc-out.txt`, `vitest` writes
 * `vitest-out.json` to its `--outputFile` and exits 1 when it holds a failed test.
 */
function project() {
  const root = mkdtempSync(join(tmpdir(), "moku-builder-check-"));
  spawnSync("node", [RAILS, "session", "start", "--root", root], { encoding: "utf8" });
  writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "4.0.0" } }));
  writeFileSync(join(root, "tsconfig.json"), "{}");
  mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
  bin(root, "tsc", 'const fs = require("fs"); const out = fs.existsSync("tsc-out.txt") ? fs.readFileSync("tsc-out.txt", "utf8") : ""; process.stdout.write(out); process.exit(out ? 2 : 0);');
  bin(root, "vitest", 'const fs = require("fs"); const file = process.argv.find((a) => a.startsWith("--outputFile=")).slice(13); const report = fs.existsSync("vitest-out.json") ? fs.readFileSync("vitest-out.json", "utf8") : JSON.stringify({ testResults: [] }); fs.writeFileSync(file, report); process.exit(report.includes("\\"failed\\"") ? 1 : 0);');
  mkdirSync(join(root, "src", "plugins", "board"), { recursive: true });
  return root;
}

function bin(root, name, body) {
  const file = join(root, "node_modules", ".bin", name);
  writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(file, 0o755);
}

const report = (verdict = "PASS", extra = {}) => `Built.\n\`\`\`json\n${JSON.stringify({ agent: "moku-builder", plugin: "board", verdict, files: ["src/plugins/board/index.ts", "src/plugins/board/api.ts"], blockers: [], ...extra })}\n\`\`\``;
const stop = (root, extra = {}, env = {}) => hook("on-builder-stop.mjs", { cwd: root, agent_id: "b-1", agent_type: "moku:moku-builder", stop_hook_active: false, last_assistant_message: report(), ...extra }, env);
const start = (root, id = "b-1") => hook("on-builder-start.mjs", { cwd: root, agent_id: id, agent_type: "moku:moku-builder" });
const OLD = "src/plugins/board/api.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\n";
const NEW = "src/plugins/board/api.ts(9,1): error TS2554: Expected 1 arguments, but got 2.\n";
const ELSEWHERE = "src/plugins/shop/api.ts(1,1): error TS2304: Cannot find name 'x'.\n";

/** Wait for the detached baseline `tsc` of `on-builder-start.mjs` to write its file. */
function baselineDone(root) {
  const record = JSON.parse(readFileSync(join(root, CHECKS, "b-1.agent.json"), "utf8"));
  for (let i = 0; i < 100; i++) {
    const file = join(root, CHECKS, record.baseline);
    if (existsSync(file) && JSON.parse(readFileSync(file, "utf8")).status === "done") return;
    spawnSync("sleep", ["0.05"]);
  }
  throw new Error("the baseline never finished");
}

describe("the builder's own checks", () => {
  it("parse tsc output, count new errors against the baseline, ignore the line", () => {
    const [old] = parseTsc(OLD);
    const moved = { ...old, line: 30 };
    assert.deepEqual(old, { file: "src/plugins/board/api.ts", line: 3, code: "TS2322", message: "Type 'string' is not assignable to type 'number'." });
    assert.deepEqual(newErrors([moved], [old]), []);
    assert.equal(newErrors([moved, moved], [old]).length, 1);
  });

  it("scope a unit to its plugin or feature folder, or to its files when it spans several", () => {
    assert.deepEqual(unitScope("/p", { files: ["features/board/index.ts", "features/board/__tests__/a.test.ts"] }), { dirs: ["features/board"], files: [] });
    assert.deepEqual(unitScope("/p", { files: ["src/pages/home.tsx", "src/lib/fmt.ts"] }), { dirs: [], files: ["src/pages/home.tsx", "src/lib/fmt.ts"] });
  });

  it("cut the block to what failed", () => {
    const errors = Array.from({ length: 30 }, (_, i) => ({ file: "a.ts", line: i, code: "TS1", message: "x".repeat(1000) }));
    const reason = blockReason({ dirs: ["src/plugins/a"], files: [] }, errors, []);
    assert.ok(reason.length <= 4100);
    assert.match(reason, /tsc: 30 new errors/);
  });

  it("let a clean PASS through and log it", () => {
    const root = project();
    start(root);
    const result = stop(root);
    assert.equal(result.out, "");
    const line = JSON.parse(readFileSync(join(root, CHECKS, "checks.jsonl"), "utf8").trim());
    assert.equal(line.checked, true);
    assert.equal(line.blocked, false);
  });

  it("block a PASS once with only the new error of its unit, never the baseline's or another unit's", () => {
    const root = project();
    writeFileSync(join(root, "tsc-out.txt"), OLD);
    start(root);
    baselineDone(root);
    writeFileSync(join(root, "tsc-out.txt"), OLD.replace("(3,", "(5,") + NEW + ELSEWHERE);

    const { decision, reason } = JSON.parse(stop(root).out);
    assert.equal(decision, "block");
    assert.match(reason, /tsc: 1 new error\n/);
    assert.match(reason, /TS2554/);
    assert.doesNotMatch(reason, /TS2322|shop/);

    const second = JSON.parse(stop(root, { stop_hook_active: true }).out);
    assert.equal(second.decision, undefined);
    assert.match(second.systemMessage, /still has 1 new tsc error/);
  });

  it("pass a PASS whose only error was there before it started", () => {
    const root = project();
    writeFileSync(join(root, "tsc-out.txt"), OLD);
    start(root);
    baselineDone(root);
    assert.equal(stop(root).out, "");
  });

  it("block on a failing test of the unit, with its message", () => {
    const root = project();
    start(root);
    writeFileSync(join(root, "vitest-out.json"), JSON.stringify({ testResults: [{ name: join(root, "src/plugins/board/__tests__/api.test.ts"), status: "failed", assertionResults: [{ status: "failed", fullName: "board drops into maxTier", failureMessages: ["AssertionError: expected 2 to be 3"] }, { status: "passed", fullName: "board ok" }] }] }));

    const { decision, reason } = JSON.parse(stop(root).out);
    assert.equal(decision, "block");
    assert.match(reason, /tests: 1 failing/);
    assert.match(reason, /board drops into maxTier\n {4}AssertionError: expected 2 to be 3/);
    assert.doesNotMatch(reason, /board ok/);
  });

  it("stay out of a FAIL, a stop with no report, a delta that was red before, and other agents", () => {
    const root = project();
    writeFileSync(join(root, "tsc-out.txt"), NEW);
    assert.equal(stop(root, { last_assistant_message: report("FAIL") }).out, "");
    assert.equal(stop(root, { last_assistant_message: "Working on it." }).out, "");
    assert.equal(stop(root, { agent_type: "moku:moku-tweaker" }).out, "");
    assert.equal(stop(root, {}, { MOKU_BUILDER_CHECK: "off" }).out, "");

    writeFileSync(join(root, "tsc-out.txt"), "");
    writeFileSync(join(root, "vitest-out.json"), JSON.stringify({ testResults: [{ name: "x", status: "failed", assertionResults: [{ status: "failed", fullName: "old red" }] }] }));
    assert.equal(stop(root, { last_assistant_message: report("PASS", { tests: { preexistingGreen: false } }) }).out, "");
  });

  it("compare a retry with the baseline of the attempt that failed, not with the errors it left", () => {
    const root = project();
    start(root);
    baselineDone(root);
    writeFileSync(join(root, "tsc-out.txt"), NEW);
    assert.equal(stop(root, { last_assistant_message: report("FAIL") }).out, "");

    // The deep retry starts on a tree that has the failed attempt's error
    hook("on-builder-start.mjs", { cwd: root, agent_id: "b-2", agent_type: "moku:moku-builder-deep" });
    const { decision, reason } = JSON.parse(hook("on-builder-stop.mjs", { cwd: root, agent_id: "b-2", agent_type: "moku:moku-builder-deep", last_assistant_message: report() }).out);
    assert.equal(decision, "block");
    assert.match(reason, /TS2554/);
  });
});

describe("the design check at the end of a UI unit", () => {
  /** A project whose design `cards` is captured, with a result and deviations as given. */
  function designProject({ result, deviations } = {}) {
    const root = project();
    const dir = join(root, ".planning", "design", "cards");
    mkdirSync(join(dir, "check"), { recursive: true });
    writeFileSync(join(dir, "check", "expected.json"), JSON.stringify({ schema: "moku-fidelity/expected@1", complete: true, inventory: [] }));
    if (result) writeFileSync(join(dir, "check", "result.json"), JSON.stringify({ at: new Date(Date.now() + 5000).toISOString(), ...result }));
    if (deviations) writeFileSync(join(dir, "deviations.json"), JSON.stringify({ deviations }));
    return root;
  }
  const withDesign = (verdict = "PASS") => ({ last_assistant_message: report("PASS", { design: { slug: "cards", verdict } }) });
  const clean = { verdict: "PASS", rows: 10, pass: 10, decision: 0, open: 0, fail: 0, unmeasured: 0, pendingDeviations: 0, missingSizes: [] };

  it("block a UI unit once when its design check never ran", () => {
    const root = designProject();
    const { decision, reason } = JSON.parse(stop(root, withDesign()).out);
    assert.equal(decision, "block");
    assert.match(reason, /moku-fidelity check \.planning\/design\/cards/);
  });

  it("block with the failing rows, so the builder fixes them in its own turn", () => {
    const root = designProject({ result: { summary: { ...clean, verdict: "FAIL", fail: 1, pass: 9 }, rows: [{ row: "blank1|drawn|390x844|misted", result: "fail", expected: "fill+stroke", actual: "image (frost-row-locked)", note: "drawn differently" }] } });
    const { decision, reason } = JSON.parse(stop(root, withDesign()).out);
    assert.equal(decision, "block");
    assert.match(reason, /blank1\|drawn\|390x844\|misted: expected fill\+stroke, actual image/);
  });

  it("let a clean unit through, and send waiting deviations to the orchestrator without a block", () => {
    assert.equal(stop(designProject({ result: { summary: clean, rows: [] } }), withDesign()).out, "");

    const root = designProject({ result: { summary: { ...clean, verdict: "FAIL", open: 2, pendingDeviations: 1 }, rows: [] }, deviations: [{ id: "D1", element: "help", prop: "font", reason: "weight 800 is not vendored", proposal: "700", decision: null }] });
    const out = JSON.parse(stop(root, withDesign()).out);
    assert.equal(out.decision, undefined);
    assert.match(out.systemMessage, /Ask the person now.*D1 help·font: weight 800 is not vendored → proposal: 700/);
  });

  it("send waiting deviations to the orchestrator also when the builder reports FAIL", () => {
    const root = designProject({ result: { summary: { ...clean, verdict: "FAIL", open: 1, pendingDeviations: 1 }, rows: [] }, deviations: [{ id: "D1", element: "glow", prop: "shadow", reason: "no blur", proposal: "rings", decision: null }] });
    const out = JSON.parse(stop(root, { last_assistant_message: report("FAIL", { design: { slug: "cards", verdict: "FAIL" } }) }).out);
    assert.equal(out.decision, undefined);
    assert.match(out.systemMessage, /Ask the person now.*D1 glow·shadow/);
  });

  it("hand an unmeasurable unit to the orchestrator, and ignore a design never captured", () => {
    const out = JSON.parse(stop(designProject(), withDesign("unmeasured")).out);
    assert.match(out.systemMessage, /could not measure it here/);
    assert.equal(stop(project(), withDesign()).out, "");
  });
});
