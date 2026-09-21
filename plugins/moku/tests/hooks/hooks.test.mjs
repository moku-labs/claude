import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * A temp project with a started session. `initialized` adds the marker the init station leaves behind.
 */
function project({ initialized }) {
  const root = mkdtempSync(join(tmpdir(), "moku-hooks-"));
  rails(root, "session", "start");
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

describe("pre-bash hook", () => {
  const bash = (root, command) => ({ cwd: root, tool_name: "Bash", tool_input: { command } });

  it("blocks a heredoc that writes a plugin into an uninitialized directory", () => {
    const root = project({ initialized: false });

    const result = hook("pre-bash.mjs", bash(root, "mkdir -p src/plugins/streak && cat > src/plugins/streak/index.ts <<'EOF'\nexport {};\nEOF"));

    assert.equal(result.code, 2);
    assert.match(result.err, /not initialized/);
  });

  it("lets ordinary commands through", () => {
    assert.equal(hook("pre-bash.mjs", bash(project({ initialized: false }), "git status && ls src")).code, 0);
  });

  it("lets the plan station write a planning document that names source paths", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-21-flow", "--size", "M", "--type", "feature");
    rails(root, "skip", "design", "--reason", "no screens");
    rails(root, "enter", "plan");

    assert.equal(hook("pre-bash.mjs", bash(root, "cat >> .planning/specs/03-flow.md <<'EOF'\nsrc/plugins/flow/index.ts\nEOF")).code, 0);
    assert.equal(hook("pre-bash.mjs", bash(root, "grep -rn createPlugin src/ 2>/dev/null")).code, 0);
    assert.equal(hook("pre-bash.mjs", bash(root, "echo x > src/a.ts")).code, 2);
  });

  it("leaves commands aimed at another repository alone", () => {
    const root = project({ initialized: true });
    const other = mkdtempSync(join(tmpdir(), "moku-other-"));

    assert.equal(hook("pre-bash.mjs", bash(root, `cd ${other} && echo x > src/a.ts`)).code, 0);
    assert.equal(hook("pre-bash.mjs", bash(root, `touch ${join(other, "src", "a.ts")}`)).code, 0);
  });

  it("treats a mistyped rails option as strict, never as off", () => {
    const root = project({ initialized: false });

    assert.equal(hook("pre-bash.mjs", bash(root, "touch src/plugins/x/index.ts"), { CLAUDE_PLUGIN_OPTION_RAILS: "of" }).code, 2);
  });
});

describe("commit hook", () => {
  /** Run the shell hook inside a project whose planning state exists. */
  function commitHook(command) {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "STATE.md"), "## Phase: build\n");

    const run = spawnSync("bash", [join(PLUGIN, "hooks", "verify-before-commit.sh")], { input: JSON.stringify({ tool_input: { command } }), cwd: root, encoding: "utf8" });
    return run.status;
  }

  it("refuses staging or committing .planning", () => {
    assert.equal(commitHook("git add .planning/STATE.md"), 2);
    assert.equal(commitHook("git status && git add -f .planning"), 2);
    assert.equal(commitHook('git commit -m "state" .planning/state.json'), 2);
  });

  it("lets read-only git commands name .planning, also next to a git add of something else", () => {
    assert.equal(commitHook("git status --short .planning"), 0);
    assert.equal(commitHook("git add src/a.ts && git check-ignore .planning"), 0);
    assert.equal(commitHook("git add -A; git status; ls .planning"), 0);
  });

  it("lets a commit message on several lines mention .planning", () => {
    assert.equal(commitHook("git commit -m \"$(cat <<'EOF'\nguard: judge the write target\n\nShell edits of .planning/ specs pass.\nEOF\n)\""), 0);
  });
});

describe("plugin index hook", () => {
  /** Write an index.ts with this many wiring lines and return the hook's verdict. */
  function indexHook(lines, settings) {
    const root = project({ initialized: true });
    building(root);
    if (settings) {
      mkdirSync(join(root, ".claude"), { recursive: true });
      writeFileSync(join(root, ".claude", "moku.local.md"), settings);
    }
    const content = `/** Very Complex tier. */\nimport { a } from "./a";\n${"wire(a);\n".repeat(lines)}`;

    return hook("pre-write.mjs", write(root, "src/plugins/flow/index.ts", content));
  }

  it("accepts a Very Complex wiring harness of 40 effective lines", () => {
    assert.equal(indexHook(40).code, 0);
  });

  it("refuses 41 lines and prints the limit", () => {
    const result = indexHook(41);

    assert.equal(result.code, 2);
    assert.match(result.err, /≤40 wiring lines.*got 41/);
  });

  it("reads another limit from .claude/moku.local.md", () => {
    assert.equal(indexHook(31, "---\npluginIndexMaxLines: 30\n---\n").code, 2);
    assert.equal(indexHook(45, "---\npluginIndexMaxLines: 50\n---\n").code, 0);
  });
});

describe("stop hook", () => {
  it("does not trap a user behind a stale 'building' row when no change is open", () => {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "STATE.md"), "| 1 | router | building |\n");

    assert.equal(hook("on-stop.mjs", { cwd: root }).out, "");
  });

  it("stays out of the way when the ledger is corrupt instead of crashing", () => {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "state.json"), "{ broken");

    assert.equal(hook("on-stop.mjs", { cwd: root }).code, 0);
  });

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

describe("subagent stop hook", () => {
  it("logs the verdict from a plugin-qualified agent's contract, even with nested findings", () => {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "STATE.md"), "## Phase: build\n");
    const report = 'Done.\n```json\n{"agent":"moku-builder","verdict":"FAIL","blockers":[{"file":"a.ts","line":1}],"warnings":[]}\n```';

    hook("on-subagent-stop.mjs", { cwd: root, agent_type: "moku:moku-builder", last_assistant_message: report });

    assert.match(readFileSync(join(root, ".planning", "build", "agent-log.md"), "utf8"), /moku:moku-builder \| FAIL B:1 W:0/);
  });

  it("ignores agents that are not moku's", () => {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "STATE.md"), "## Phase: build\n");

    hook("on-subagent-stop.mjs", { cwd: root, agent_type: "Explore", last_assistant_message: "x" });

    assert.equal(existsSync(join(root, ".planning", "build", "agent-log.md")), false);
  });
});

describe("off the rails", () => {
  /**
   * A repository that names @moku-labs/* in its manifest and never started a moku session (issue 14).
   */
  function foreign() {
    const root = mkdtempSync(join(tmpdir(), "moku-foreign-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@moku-labs/ci", devDependencies: { "@moku-labs/common": "1.0.0" } }));
    return root;
  }

  it("lets every write through in a repository that only names @moku-labs in its manifest", () => {
    const root = foreign();

    assert.equal(hook("pre-write.mjs", write(root, "src/lib/argv.ts")).code, 0);
    assert.equal(hook("pre-write.mjs", write(root, "src/plugins/auth/index.ts")).code, 0);
  });

  it("lets shell writes through and never blocks stopping", () => {
    const root = foreign();

    assert.equal(hook("pre-bash.mjs", { cwd: root, tool_input: { command: "echo x > src/plugins/auth/index.ts" } }).code, 0);
    assert.equal(hook("on-stop.mjs", { cwd: root }).out, "");
  });

  it("says nothing on a prompt that does not name moku, and writes no ledger", () => {
    const root = foreign();

    assert.equal(hook("on-prompt.mjs", { cwd: root, prompt: "fix the argv parser" }).out, "");
    assert.equal(existsSync(join(root, ".planning")), false);
  });

  it("points at the session skill when the person names moku", () => {
    assert.match(hook("on-prompt.mjs", { cwd: foreign(), prompt: "Хочу сделать сайт для проекта moku" }).out, /moku:session/);
  });
});

describe("prompt hook on the rails", () => {
  it("hands over the standing and the routing rule, and marks the request as not routed", () => {
    const root = project({ initialized: true });

    const result = hook("on-prompt.mjs", { cwd: root, prompt: "add a streak counter" });

    assert.match(result.out, /Rails: clean/);
    assert.match(result.out, /moku:moku/);
    assert.equal(JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8")).turn.routed, false);
  });

  it("closes the free pass: an open change inside build does not admit a new request until it is routed", () => {
    const root = project({ initialized: true });
    building(root);
    hook("on-prompt.mjs", { cwd: root, prompt: "also rebrand everything" });

    const refused = hook("pre-write.mjs", write(root, "src/main.ts"));
    rails(root, "continue");

    assert.equal(refused.code, 2);
    assert.match(refused.err, /not been routed/);
    assert.equal(hook("pre-write.mjs", write(root, "src/main.ts")).code, 0);
  });

  it("stays silent when the user turned the rails off", () => {
    const root = project({ initialized: true });

    assert.equal(hook("on-prompt.mjs", { cwd: root, prompt: "anything" }, { CLAUDE_PLUGIN_OPTION_RAILS: "off" }).out, "");
  });
});

describe("one root rule for every hook", () => {
  it("guards a file by the project that owns it, not by the session's cwd", () => {
    const parent = mkdtempSync(join(tmpdir(), "moku-parent-"));
    const root = join(parent, "site");
    rails(root, "session", "start");

    const result = hook("pre-write.mjs", { cwd: parent, tool_name: "Write", tool_input: { file_path: join(root, "src", "app.ts"), content: "export {};\n" } });

    assert.equal(result.code, 2);
    assert.match(result.err, /not initialized/);
  });

  it("remembers the directory a session started elsewhere, so the prompt hook finds it from the parent", () => {
    const parent = mkdtempSync(join(tmpdir(), "moku-parent-"));
    const home = mkdtempSync(join(tmpdir(), "moku-home-"));
    const env = { MOKU_HOME: home };
    rails(join(parent, "site"), "session", "start");

    hook("pre-bash.mjs", { cwd: parent, session_id: "s-1", tool_input: { command: `moku-rails session start --root "${join(parent, "site")}"` } }, env);

    assert.match(hook("on-prompt.mjs", { cwd: parent, session_id: "s-1", prompt: "go" }, env).out, /NOT initialized/);
    assert.equal(hook("on-prompt.mjs", { cwd: parent, session_id: "other", prompt: "go" }, env).out, "");
  });
});
