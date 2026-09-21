import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

import { exitCodeFor, formatReport } from "../../lib/verify/report.mjs";
import { verifyPlugin } from "../../lib/verify/verify.mjs";
import { exportName, judgeWiring, testCommand } from "../../lib/verify/wiring.mjs";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-verify-artifacts");
const roots = [];

/**
 * Build a throwaway project with one plugin in it.
 *
 * @param {Record<string, string>} files paths relative to the project root
 * @returns {string} the project root
 */
function project(files) {
  const root = mkdtempSync(join(tmpdir(), "moku-verify-"));
  roots.push(root);

  for (const [file, content] of Object.entries(files)) {
    const full = join(root, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  return root;
}

const REAL_INDEX = "/** Tier: Nano */\nimport { createPlugin } from '../../config';\nexport const streakPlugin = createPlugin('streak', {\n  config: { window: 7 },\n  api: (ctx) => ({ days: () => ctx.config.window }),\n});";
const REAL_TEST = "import { describe, it, expect } from 'vitest';\ndescribe('streak', () => {\n  it('reports the window', () => {\n    expect(streakPlugin.spec.config.window).toBe(7);\n  });\n});";

const GREEN = {
  "src/plugins/streak/index.ts": REAL_INDEX,
  "src/plugins/streak/README.md": "# streak\n",
  "src/plugins/streak/__tests__/unit/index.test.ts": REAL_TEST,
  "src/index.ts": "import { streakPlugin } from './plugins';\nexport const app = createCore(config, { plugins: [streakPlugin] });",
};

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("verifyPlugin", () => {
  it("passes a complete nano plugin", () => {
    const report = verifyPlugin({ root: project(GREEN), name: "streak" });

    assert.equal(report.verdict, "PASS");
    assert.deepEqual(report.findings, []);
    assert.equal(report.tier, "nano");
    assert.equal(exitCodeFor(report), 0);
  });

  it("fails a plugin whose directory does not exist", () => {
    const report = verifyPlugin({ root: project(GREEN), name: "missing" });

    assert.equal(report.verdict, "FAIL");
    assert.equal(report.findings[0].level, 1);
  });

  it("reports the files a tier requires but the directory lacks", () => {
    const report = verifyPlugin({ root: project({ ...GREEN, "src/plugins/streak/api.ts": "export const api = () => ({ a: 1, b: 2, c: 3 });" }), name: "streak", tier: "standard" });

    const missing = report.findings.filter((finding) => finding.level === 1).map((finding) => finding.file);
    assert.ok(missing.includes("types.ts"));
    assert.ok(missing.includes("__tests__/integration/streak.test.ts"));
    assert.ok(missing.includes("__tests__/unit/api.test.ts"));
  });

  it("reports a stub implementation", () => {
    const files = { ...GREEN, "src/plugins/streak/index.ts": "// TODO: build the streak plugin\n" };
    const report = verifyPlugin({ root: project(files), name: "streak", tier: "nano" });

    const stub = report.findings.find((finding) => finding.level === 2);
    assert.equal(stub.file, "index.ts");
    assert.match(stub.message, /stub/);
  });

  it("reports a test with no assertions", () => {
    const files = { ...GREEN, "src/plugins/streak/__tests__/unit/index.test.ts": "it('works', () => {\n  const plugin = streakPlugin;\n  plugin.spec.api;\n  plugin.name;\n});" };
    const report = verifyPlugin({ root: project(files), name: "streak", tier: "nano" });

    assert.match(report.findings.find((finding) => finding.level === 2).message, /no assertions/);
  });

  it("reports a plugin that is never composed", () => {
    const files = { ...GREEN, "src/index.ts": "export const app = createCore(config, { plugins: [] });" };
    const report = verifyPlugin({ root: project(files), name: "streak", tier: "nano" });

    const wiring = report.findings.find((finding) => finding.level === 3);
    assert.match(wiring.message, /streakPlugin is not registered/);
  });

  it("skips the command runs unless --run asked for them", () => {
    const report = verifyPlugin({ root: project(GREEN), name: "streak" });

    assert.deepEqual(report.checks, []);
  });
});

describe("judgeWiring", () => {
  it("names a plugin export from its directory name", () => {
    assert.equal(exportName("template-engine"), "templateEnginePlugin");
  });

  it("ignores a mention inside a comment", () => {
    const wiring = judgeWiring("streak", [{ file: "src/index.ts", source: "// streakPlugin goes here one day\nplugins: []" }]);

    assert.equal(wiring.wired, false);
  });

  it("accepts a plugin composed through createApp", () => {
    const wiring = judgeWiring("streak", [{ file: "src/main.ts", source: "createApp({ plugins: [streakPlugin] });" }]);

    assert.equal(wiring.wired, true);
    assert.equal(wiring.where, "src/main.ts");
  });
});

describe("formatReport", () => {
  it("opens with the plugin, tier and verdict", () => {
    const lines = formatReport(verifyPlugin({ root: project(GREEN), name: "streak" }));

    assert.equal(lines[0], "streak (nano): PASS");
    assert.match(lines.at(-1), /all three levels pass/);
  });
});

describe("the CLI", () => {
  it("exits 1 with usage when no plugin is named", () => {
    const failure = run([]);

    assert.equal(failure.status, 1);
    assert.match(failure.output, /Usage: moku-verify-artifacts/);
  });

  it("exits 1 on a tier that does not exist", () => {
    assert.equal(run(["streak", "--tier", "gigantic"]).status, 1);
  });

  it("exits 0 and prints JSON for a green plugin", () => {
    const success = run(["streak", "--root", project(GREEN), "--json"]);

    assert.equal(success.status, 0);
    assert.equal(JSON.parse(success.output).verdict, "PASS");
  });

  it("exits 2 when verification fails", () => {
    const failure = run(["missing", "--root", project(GREEN)]);

    assert.equal(failure.status, 2);
  });
});

/**
 * Run the bin entry and capture status and output.
 *
 * @param {string[]} args CLI arguments
 * @returns {{ status: number, output: string }}
 */
function run(args) {
  try {
    return { status: 0, output: execFileSync(process.execPath, [BIN, ...args], { encoding: "utf8" }) };
  } catch (error) {
    return { status: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

describe("testCommand", () => {
  it("runs Vitest when the project tests with Vitest", () => {
    const manifest = { devDependencies: { vitest: "^3.2.0" }, scripts: { test: "vitest run" } };

    assert.deepEqual(testCommand(manifest, "src/plugins/time"), { command: "bunx", args: ["vitest", "run", "src/plugins/time"] });
  });

  it("keeps bun test for a project without Vitest, or without a manifest", () => {
    assert.deepEqual(testCommand({ devDependencies: {} }, "src/plugins/time"), { command: "bun", args: ["test", "src/plugins/time"] });
    assert.deepEqual(testCommand(undefined, "src/plugins/time"), { command: "bun", args: ["test", "src/plugins/time"] });
  });
});
