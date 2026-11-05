import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** A machine: a Claude config folder, a moku home and a project on the rails with one uncommitted file. */
function machine() {
  const base = mkdtempSync(join(tmpdir(), "moku-handoff-"));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: join(base, "config"), MOKU_HOME: join(base, "moku") };
  const root = join(base, "site");
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  writeFileSync(join(root, "draft.ts"), "export {};\n");

  const rails = (/** @type {string[]} */ ...args) => {
    const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8", env });
    return { code: run.status, text: `${run.stdout}${run.stderr}`, json: () => JSON.parse(run.stdout || run.stderr) };
  };
  rails("session", "start");
  writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: site\n");

  return { base, env, root, rails };
}

/**
 * Write a transcript the way Claude Code lays it out: `projects/<folder>/<id>.jsonl`, the cwd in the first
 * lines. The user message holds a string the checkpoint must never carry.
 */
function transcript(config, { id, cwd, entrypoint = "cli", folder = "site", ageHours = 0 }) {
  const file = join(config, "projects", folder, `${id}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });
  const lines = [
    { type: "queue-operation", sessionId: id },
    { type: "user", cwd, entrypoint, sessionId: id, message: { role: "user", content: "token sk-do-not-copy" } },
  ];
  writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
  const when = new Date(Date.now() - ageHours * 60 * 60 * 1000);
  utimesSync(file, when, when);
  return file;
}

const ID_CLI = "11111111-1111-4111-8111-111111111111";
const ID_DESKTOP = "22222222-2222-4222-8222-222222222222";

describe("moku-rails handoff", () => {
  it("saves every recent session on the rails with its change, station, branch and uncommitted count", () => {
    const { env, root, rails } = machine();
    rails("open", "2026-11-05-fix", "--size", "S", "--type", "fix");
    rails("enter", "build");
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    const saved = rails("handoff", "save", "--include-temp", "--json").json();

    assert.equal(saved.code, 0);
    const [session] = saved.data.sessions;
    assert.equal(session.id, ID_CLI);
    assert.equal(session.cwd, root);
    assert.equal(session.surface, "cli");
    assert.deepEqual(session.change, { id: "2026-11-05-fix", station: "build", size: "S" });
    assert.equal(session.branch, "main");
    assert.ok(session.uncommitted >= 1);
    assert.ok(existsSync(join(env.MOKU_HOME, "handoff.json")));
  });

  it("leaves out stale sessions, sessions off the rails, subagent transcripts and, by default, temp folders", () => {
    const { base, env, root, rails } = machine();
    const elsewhere = join(base, "other");
    mkdirSync(elsewhere);
    transcript(env.CLAUDE_CONFIG_DIR, { id: "stale", cwd: root, ageHours: 30 });
    transcript(env.CLAUDE_CONFIG_DIR, { id: "off-rails", cwd: elsewhere, folder: "other" });
    transcript(env.CLAUDE_CONFIG_DIR, { id: "agent-1", cwd: root, folder: join("site", ID_CLI, "subagents") });
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    assert.deepEqual(rails("handoff", "save", "--include-temp", "--json").json().data.sessions.map((session) => session.id), [ID_CLI]);
    assert.match(rails("handoff", "save").text, /Nothing to save/);
    assert.equal(rails("handoff", "save", "--include-temp", "--since", "48", "--json").json().data.sessions.length, 2);
  });

  it("never copies anything of the conversation into the checkpoint", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    rails("handoff", "save", "--include-temp");

    assert.doesNotMatch(readFileSync(join(env.MOKU_HOME, "handoff.json"), "utf8"), /sk-do-not-copy|content/);
  });

  it("prints one resume command per session, in the desktop app for a Code tab session", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_DESKTOP, cwd: root, entrypoint: "claude-desktop" });
    rails("handoff", "save", "--include-temp");

    const resumed = rails("handoff", "resume");
    const forced = rails("handoff", "resume", "--cli");

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
    rails("handoff", "save", "--include-temp");

    rails("done", "build");
    writeFileSync(join(root, "second.ts"), "export {};\n");
    const notes = rails("handoff", "resume").text;
    const otherFolder = rails("handoff", "resume", "--config-dir", join(base, "work-config")).text;

    assert.match(notes, /the station moved from build/);
    assert.match(notes, /uncommitted files: \d+ at save, \d+ now/);
    assert.match(otherFolder, /its transcript is not in .*work-config/);
    assert.match(otherFolder, /resumes only from the config folder that holds its transcript/);
  });

  it("refuses resume without a checkpoint, and clear is safe to repeat", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    rails("handoff", "save", "--include-temp");

    assert.equal(rails("handoff", "clear").code, 0);
    assert.equal(rails("handoff", "clear").code, 0);
    assert.equal(rails("handoff", "resume").code, 2);
    assert.equal(rails("handoff", "jump").code, 1);
  });
});
