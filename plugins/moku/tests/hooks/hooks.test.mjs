import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAILS = join(PLUGIN, "bin", "moku-rails");

/** Run a hook script with a JSON payload on stdin. */
function hook(name, payload, env = {}) {
  const run = spawnSync("node", [join(PLUGIN, "hooks", name)], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, ...env } });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

function project({ initialized }) {
  const root = mkdtempSync(join(tmpdir(), "moku-hooks-"));
  if (initialized) {
    mkdirSync(join(root, ".planning"), { recursive: true });
    writeFileSync(join(root, ".planning", "moku.md"), "type: framework\nname: demo\n");
  }
  return root;
}

function rails(root, ...args) {
  return spawnSync("node", [RAILS, ...args, "--root", root], { encoding: "utf8" });
}

function building(root) {
  rails(root, "open", "2026-09-19-demo", "--size", "S", "--type", "fix");
  rails(root, "enter", "intake");
  rails(root, "done", "intake");
  rails(root, "enter", "build");
}

const write = (root, file, content = "export {};\n") => ({ cwd: root, tool_name: "Write", tool_input: { file_path: join(root, file), content } });

describe("pre-write hook", () => {
  it("blocks a plugin file written into an uninitialized directory", () => {
    const root = project({ initialized: false });

    const result = hook("pre-write.mjs", write(root, "src/plugins/streak/index.ts"));

    assert.equal(result.code, 2);
    assert.match(result.err, /not initialized/);
  });

  it("lets planning files through before init", () => {
    const root = project({ initialized: false });

    assert.equal(hook("pre-write.mjs", write(root, ".planning/changes/x/intake.md", "# intake\n")).code, 0);
  });

  it("allows plugin source while the change is being built", () => {
    const root = project({ initialized: true });
    building(root);

    assert.equal(hook("pre-write.mjs", write(root, "src/plugins/streak/api.ts")).code, 0);
  });

  it("still runs the content checks: explicit generics on createPlugin are refused", () => {
    const root = project({ initialized: true });
    building(root);

    const result = hook("pre-write.mjs", write(root, "src/plugins/streak/index.ts", 'export const streakPlugin = createPlugin<"streak">("streak", {});\n'));

    assert.equal(result.code, 2);
    assert.match(result.err, /generics/i);
  });

  it("only warns when the user set rails to warn", () => {
    const root = project({ initialized: false });

    const result = hook("pre-write.mjs", write(root, "src/plugins/streak/index.ts"), { CLAUDE_PLUGIN_OPTION_RAILS: "warn" });

    assert.equal(result.code, 0);
    assert.match(result.err, /warn/);
  });
});

describe("stop hook", () => {
  it("blocks stopping in the middle of a build", () => {
    const root = project({ initialized: true });
    building(root);

    assert.match(hook("on-stop.mjs", { cwd: root }).out, /"decision":"block"/);
  });

  it("allows stopping once the change is paused for the user", () => {
    const root = project({ initialized: true });
    building(root);
    rails(root, "pause", "--reason", "waiting for approval");

    assert.equal(hook("on-stop.mjs", { cwd: root }).out, "");
  });

  it("never blocks twice in a row", () => {
    const root = project({ initialized: true });
    building(root);

    assert.equal(hook("on-stop.mjs", { cwd: root, stop_hook_active: true }).out, "");
  });
});

describe("session hook", () => {
  it("is silent outside moku projects", () => {
    assert.equal(hook("session-rails.mjs", { cwd: mkdtempSync(join(tmpdir(), "plain-")) }).out, "");
  });

  it("reports where an initialized project stands", () => {
    const root = project({ initialized: true });

    assert.match(hook("session-rails.mjs", { cwd: root }).out, /Rails: clean/);
  });
});
