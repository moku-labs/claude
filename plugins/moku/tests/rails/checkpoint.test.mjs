import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** A machine: a Claude config folder, a moku home and a project on the rails with one uncommitted file. */
function machine() {
  const base = mkdtempSync(join(tmpdir(), "moku-checkpoint-"));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: join(base, "config"), MOKU_HOME: join(base, "moku") };
  const root = join(base, "site");
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  writeFileSync(join(root, "draft.ts"), "export {};\n");

  const railsAt = (/** @type {string} */ dir, /** @type {string[]} */ ...args) => {
    const run = spawnSync("node", [CLI, ...args, "--root", dir], { encoding: "utf8", env });
    return { code: run.status, text: `${run.stdout}${run.stderr}`, json: () => JSON.parse(run.stdout || run.stderr) };
  };
  const rails = (/** @type {string[]} */ ...args) => railsAt(root, ...args);
  rails("session", "start");
  writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: site\n");

  return { base, env, root, rails, railsAt };
}

/**
 * Write a transcript the way Claude Code lays it out: `projects/<folder>/<id>.jsonl`, the cwd in the first
 * lines. The user message holds a string the checkpoint must never carry.
 */
function transcript(config, { id, cwd, entrypoint = "cli", folder = "site", ageHours = 0, extra = [] }) {
  const file = join(config, "projects", folder, `${id}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });
  const lines = [
    { type: "queue-operation", sessionId: id },
    { type: "user", cwd, entrypoint, sessionId: id, message: { role: "user", content: "token sk-do-not-copy" } },
    ...extra,
  ];
  writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
  const when = new Date(Date.now() - ageHours * 60 * 60 * 1000);
  utimesSync(file, when, when);
  return file;
}

const ID_CLI = "11111111-1111-4111-8111-111111111111";
const ID_DESKTOP = "22222222-2222-4222-8222-222222222222";

/** An assistant tool call and the result Claude Code records for it. */
function call(id, name, input, result) {
  return [
    { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: result }] } },
  ];
}

/** The notification a background task sends when it ends. */
function reported(id) {
  return { type: "user", message: { role: "user", content: `<task-notification> <task-id>t</task-id> <tool-use-id>${id}</tool-use-id> <status>completed</status></task-notification>` } };
}

/** The checkpoint files written so far. */
function checkpoints(env) {
  const dir = join(dirname(env.MOKU_HOME), "moku-checkpoints");
  return existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)) : [];
}

describe("moku-rails checkpoint", () => {
  it("saves every recent session on the rails with its change, station, branch and uncommitted count", () => {
    const { env, root, rails } = machine();
    rails("open", "2026-11-05-fix", "--size", "S", "--type", "fix");
    rails("enter", "build");
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    const saved = rails("checkpoint", "--include-temp", "--json").json();

    assert.equal(saved.code, 0);
    const [session] = saved.data.sessions;
    assert.equal(session.id, ID_CLI);
    assert.equal(session.cwd, root);
    assert.equal(session.surface, "cli");
    assert.deepEqual(session.change, { id: "2026-11-05-fix", title: "2026-11-05-fix", size: "S", station: "build", next: "inside build" });
    assert.equal(session.branch, "main");
    assert.ok(session.uncommitted.includes("draft.ts"));
    assert.deepEqual(checkpoints(env), [saved.data.file]);
  });

  it("leaves out stale sessions, sessions off the rails, subagent transcripts and, by default, other temp folders", () => {
    const { base, env, root, rails, railsAt } = machine();
    const elsewhere = join(base, "other");
    mkdirSync(elsewhere);
    transcript(env.CLAUDE_CONFIG_DIR, { id: "stale", cwd: root, ageHours: 60 });
    transcript(env.CLAUDE_CONFIG_DIR, { id: "yesterday", cwd: root, ageHours: 30 });
    transcript(env.CLAUDE_CONFIG_DIR, { id: "off-rails", cwd: elsewhere, folder: "other" });
    transcript(env.CLAUDE_CONFIG_DIR, { id: "agent-1", cwd: root, folder: join("site", ID_CLI, "subagents") });
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    assert.deepEqual(rails("checkpoint", "--include-temp", "--json").json().data.sessions.map((session) => session.id), [ID_CLI, "yesterday"]);
    assert.match(railsAt(mkdtempSync(join(tmpdir(), "moku-elsewhere-")), "checkpoint").text, /Nothing to save/);
    assert.equal(rails("checkpoint", "--json").json().data.sessions.length, 2, "a temp folder counts when the command runs in it");
    assert.equal(rails("checkpoint", "--include-temp", "--since", "72", "--json").json().data.sessions.length, 3);
    assert.equal(rails("checkpoint", "--include-temp", "--since", "12", "--json").json().data.sessions.length, 1);
  });

  it("never copies anything of the conversation into the checkpoint", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    rails("checkpoint", "--include-temp");

    assert.doesNotMatch(readFileSync(checkpoints(env)[0], "utf8"), /sk-do-not-copy|content/);
  });

  it("prints one resume command per session, in the desktop app for a Code tab session", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_DESKTOP, cwd: root, entrypoint: "claude-desktop" });
    rails("checkpoint", "--include-temp");

    const resumed = rails("resume-checkpoint");
    const forced = rails("resume-checkpoint", "--cli");

    assert.equal(resumed.code, 0);
    assert.ok(resumed.text.includes(`cd '${root}' && claude --resume ${ID_CLI}`));
    assert.ok(resumed.text.includes(`cd '${root}' && claude --desktop --resume ${ID_DESKTOP}`));
    assert.ok(forced.text.includes(`claude --resume ${ID_DESKTOP}`));
  });

  it("notes what moved since the save: the station, the tree, a transcript in another config folder", () => {
    const { base, env, root, rails } = machine();
    rails("open", "2026-11-05-fix", "--size", "S", "--type", "fix");
    rails("enter", "build");
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    rails("checkpoint", "--include-temp");

    rails("done", "build");
    writeFileSync(join(root, "second.ts"), "export {};\n");
    const notes = rails("resume-checkpoint").text;
    const otherFolder = rails("resume-checkpoint", "--config-dir", join(base, "work-config")).text;

    assert.match(notes, /the station moved from build/);
    assert.match(notes, /uncommitted files: \d+ at save, \d+ now/);
    assert.match(otherFolder, /its transcript is not in .*work-config/);
    assert.match(otherFolder, /resumes only from the config folder that holds its transcript/);
  });

  it("lists the background tasks that never reported back, and never a command that looks like a credential", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, {
      id: ID_CLI,
      cwd: root,
      extra: [
        ...call("toolu_editor", "Bash", { command: "bun run editor", description: "Start the editor", run_in_background: true }, "Command running in background with ID: b1"),
        ...call("toolu_done", "Bash", { command: "bun test", description: "Run the tests", run_in_background: true }, "Command running in background with ID: b2"),
        reported("toolu_done"),
        ...call("toolu_agent", "Agent", { description: "Build the streak plugin", prompt: "..." }, [{ type: "text", text: "Async agent launched successfully." }]),
        ...call("toolu_sync", "Agent", { description: "Look up the docs", prompt: "..." }, "The docs say ..."),
        ...call("toolu_key", "Bash", { command: "API_KEY=abc ./deploy.sh", run_in_background: true }, "Command running in background with ID: b3"),
      ],
    });

    const [session] = rails("checkpoint", "--include-temp", "--json").json().data.sessions;
    const resumed = rails("resume-checkpoint").text;

    assert.deepEqual(session.unfinished, [
      { kind: "bash", description: "Start the editor" },
      { kind: "agent", description: "Build the streak plugin" },
      { kind: "bash", description: "a background Bash" },
    ]);
    assert.match(resumed, /restart: bash "Start the editor" did not finish/);
    assert.doesNotMatch(readFileSync(checkpoints(env)[0], "utf8"), /abc|deploy/);
  });

  it("says where each change stopped and what comes next", () => {
    const { env, root, rails } = machine();
    rails("open", "2026-11-05-fix", "--size", "S", "--type", "fix", "--title", "Streak breaks at midnight");
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    const saved = rails("checkpoint", "--include-temp");

    assert.match(saved.text, /2026-11-05-fix \(Streak breaks at midnight\): next: build/);
  });

  it("resumes the newest checkpoint or a named one, and refuses when there is none", () => {
    const { env, root, rails } = machine();

    assert.equal(rails("resume-checkpoint").code, 2);
    assert.equal(rails("resume-checkpoint", join(root, "draft.ts")).code, 2);

    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    const { file } = rails("checkpoint", "--include-temp", "--json").json().data;

    assert.equal(rails("resume-checkpoint", "--json").json().data.file, file);
    assert.equal(rails("resume-checkpoint", file).code, 0);
    assert.equal(rails("checkpoint", "--since", "0").code, 1);
  });

  it("says plainly when the transcripts cannot be read, and saves nothing", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    chmodSync(join(env.CLAUDE_CONFIG_DIR, "projects"), 0o000);

    const result = rails("checkpoint");
    chmodSync(join(env.CLAUDE_CONFIG_DIR, "projects"), 0o700);

    assert.equal(result.code, 1);
    assert.match(result.text, /Could not read the transcripts .*nothing was saved/);
    assert.deepEqual(checkpoints(env), []);
  });

  it("prints a long JSON in full when stdout is a pipe", () => {
    const { env, root, rails } = machine();
    for (let index = 0; index < 1500; index += 1) writeFileSync(join(root, `file-with-a-long-enough-name-${index}.ts`), "");
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    assert.ok(rails("checkpoint", "--include-temp", "--json").json().data.sessions[0].uncommitted.length > 1500);
  });
});
