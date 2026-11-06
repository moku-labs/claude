import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** A machine: a Claude config folder, a moku home and a project on the rails with one uncommitted file. */
function machine() {
  const base = mkdtempSync(join(tmpdir(), "moku-checkpoint-"));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: join(base, "config"), MOKU_HOME: join(base, "moku"), MOKU_DESKTOP_SESSIONS: join(base, "desktop"), MOKU_DESKTOP_RUNNING: "0", MOKU_OPEN_PAUSE_MS: "0" };
  for (const name of ["CLAUDECODE", "CLAUDE_CODE_ACCOUNT_UUID", "CLAUDE_CODE_ORGANIZATION_UUID"]) delete env[name];
  const root = join(base, "site");
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  writeFileSync(join(root, "draft.ts"), "export {};\n");

  const railsAt = (/** @type {string} */ dir, /** @type {string[]} */ ...args) => {
    const extra = typeof args.at(-1) === "object" ? /** @type {Record<string, string>} */ (args.pop()) : {};
    const run = spawnSync("node", [CLI, ...args, "--root", dir], { encoding: "utf8", env: { ...env, ...extra } });
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

const OLD_ACCOUNT = "aaaaaaaa-0000-4000-8000-000000000001";
const NEW_ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER_ACCOUNT = "cccccccc-0000-4000-8000-000000000003";
const ORG = "dddddddd-0000-4000-8000-000000000004";

/** A session id that reads as a Claude Code one, from a letter. */
const sid = (/** @type {string} */ letter) => `${letter.repeat(8)}-1111-4111-8111-111111111111`;

/** A record of the desktop app: `<desktop>/<account>/<org>/<localId>.json`, with a few unrelated fields kept. */
function record(env, { account = OLD_ACCOUNT, id, localId = `local_old-${id.slice(0, 8)}`, cwd, title = "", archived = false, parent, activity = Date.now() }) {
  const file = join(env.MOKU_DESKTOP_SESSIONS, account, ORG, `${localId}.json`);
  mkdirSync(dirname(file), { recursive: true });
  const data = { sessionId: localId, cliSessionId: id, cwd, title, isArchived: archived, lastActivityAt: activity, model: "claude-opus-5-5", peerReceipts: [{ messageId: "m1" }] };
  if (parent) data.spawnedFrom = { sessionId: parent, taskId: "task_1", title, sideSession: true, name: "side" };
  writeFileSync(file, JSON.stringify(data));
  return file;
}

/** The app's record of a session opened again under the new account: `local_<cliSessionId>`, a title it made up. */
function reopen(env, id, cwd) {
  return record(env, { account: NEW_ACCOUNT, id, localId: `local_${id}`, cwd, title: "moku: renamed · build" });
}

const ACCOUNT_ENV = { CLAUDE_CODE_ACCOUNT_UUID: OLD_ACCOUNT, CLAUDE_CODE_ORGANIZATION_UUID: ORG };

describe("moku-rails checkpoint with the desktop app's sessions", () => {
  it("keeps every open session of the current account, at any age and off the rails, and no archived or other-account one", () => {
    const { base, env, root, rails } = machine();
    const offRails = join(base, "notes");
    mkdirSync(offRails);
    const config = env.CLAUDE_CONFIG_DIR;
    for (const [letter, cwd, ageHours] of [["a", root, 0], ["b", root, 1], ["c", root, 2], ["d", root, 3], ["e", offRails, 100]]) {
      transcript(config, { id: sid(letter), cwd, entrypoint: "claude-desktop", ageHours });
    }
    record(env, { id: sid("a"), cwd: root, title: "Coordinator" });
    record(env, { id: sid("b"), cwd: root, title: "Side task", parent: `local_old-${sid("a").slice(0, 8)}` });
    record(env, { id: sid("c"), cwd: root, title: "Done long ago", archived: true });
    record(env, { account: OTHER_ACCOUNT, id: sid("d"), cwd: root, title: "A copy from an earlier account" });
    record(env, { id: sid("e"), cwd: offRails, title: "Research, quiet for four days" });
    record(env, { id: sid("f"), cwd: root, title: "Its transcript is elsewhere" });

    const saved = rails("checkpoint", "--json", ACCOUNT_ENV).json().data;

    assert.deepEqual(saved.sessions.map((session) => session.id).sort(), [sid("a"), sid("b"), sid("e")]);
    const side = saved.sessions.find((session) => session.id === sid("b"));
    assert.equal(side.title, "Side task");
    assert.equal(side.localId, `local_old-${sid("b").slice(0, 8)}`);
    assert.equal(side.parent, `local_old-${sid("a").slice(0, 8)}`);
    assert.equal(side.spawnedFrom.taskId, "task_1");
    assert.equal(side.surface, "desktop");
    assert.equal(saved.sessions.find((session) => session.id === sid("e")).root, null);
    assert.deepEqual(saved.skipped.map((entry) => entry.title), ["Its transcript is elsewhere"]);
    assert.match(readFileSync(saved.file, "utf8"), /"desktopDir": ".*aaaaaaaa-0000-4000-8000-000000000001/);
  });

  it("finds the current account by its most recent session when the session does not name it", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: sid("a"), cwd: root, entrypoint: "claude-desktop" });
    transcript(env.CLAUDE_CONFIG_DIR, { id: sid("b"), cwd: root, entrypoint: "claude-desktop" });
    record(env, { account: OTHER_ACCOUNT, id: sid("a"), cwd: root, activity: Date.now() - 86_400_000 });
    record(env, { id: sid("b"), cwd: root, activity: Date.now() });

    assert.deepEqual(rails("checkpoint", "--json").json().data.sessions.map((session) => session.id), [sid("b")]);
  });
});

describe("moku-rails resume-checkpoint after a new sign-in", () => {
  /** Three generations of sessions saved under the old account: a coordinator, its side session, and that one's. */
  function family() {
    const m = machine();
    for (const letter of ["a", "b", "c"]) transcript(m.env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd: m.root, entrypoint: "claude-desktop" });
    record(m.env, { id: sid("a"), cwd: m.root, title: "Coordinator" });
    record(m.env, { id: sid("b"), cwd: m.root, title: "Episode 2", parent: `local_old-${sid("a").slice(0, 8)}` });
    record(m.env, { id: sid("c"), cwd: m.root, title: "Card texts", parent: `local_old-${sid("b").slice(0, 8)}` });
    m.rails("checkpoint", ACCOUNT_ENV);
    return m;
  }

  it("maps each old id to the new one, names the titles to set again and the message to each parent", () => {
    const { env, root, rails } = family();
    reopen(env, sid("a"), root);
    reopen(env, sid("b"), root);

    const resumed = rails("resume-checkpoint", "--json").json();
    const text = rails("resume-checkpoint").text;

    assert.deepEqual(resumed.data.idMap, {
      [`local_old-${sid("a").slice(0, 8)}`]: `local_${sid("a")}`,
      [`local_old-${sid("b").slice(0, 8)}`]: `local_${sid("b")}`,
      [`local_old-${sid("c").slice(0, 8)}`]: `local_${sid("c")}`,
    });
    assert.deepEqual(resumed.data.titles.find((entry) => entry.sessionId === `local_${sid("b")}`), { sessionId: `local_${sid("b")}`, title: "Episode 2" });
    const toCoordinator = resumed.data.messages.find((message) => message.to === `local_${sid("a")}`);
    assert.match(toCoordinator.text, new RegExp(`Episode 2: local_old-${sid("b").slice(0, 8)} → local_${sid("b")}`));
    assert.match(resumed.data.messages.find((message) => message.to === `local_${sid("b")}`).text, /Card texts/);
    assert.equal(resumed.data.messages.some((message) => message.to === `local_${sid("c")}`), false, "a session with no children and no artifacts gets no message");
    assert.match(text, /not open in the app yet as local_c+/);
    assert.match(text, /1 Code tab session is not open in the app yet/);
    assert.match(text, /set_session_title local_b+-1111-4111-8111-111111111111 "Episode 2"/);
    assert.match(text, /--relink/);
  });

  it("--relink writes parents of any depth and the titles into the new records, after a backup, only with the app closed", () => {
    const { env, root, rails } = family();
    const files = ["a", "b", "c"].map((letter) => reopen(env, sid(letter), root));
    const before = readFileSync(files[2], "utf8");

    assert.equal(rails("resume-checkpoint", "--relink", { CLAUDECODE: "1" }).code, 2, "refused inside a Claude Code session");
    assert.match(rails("resume-checkpoint", "--relink", { MOKU_DESKTOP_RUNNING: "1" }).text, /desktop app is running/);
    assert.equal(readFileSync(files[2], "utf8"), before, "nothing written while refused");

    const result = rails("resume-checkpoint", "--relink", "--json").json();
    const [coordinator, episode, cards] = files.map((file) => JSON.parse(readFileSync(file, "utf8")));

    assert.equal(result.code, 0);
    assert.equal(coordinator.spawnedFrom, undefined);
    assert.equal(episode.spawnedFrom.sessionId, `local_${sid("a")}`);
    assert.equal(cards.spawnedFrom.sessionId, `local_${sid("b")}`);
    assert.equal(cards.spawnedFrom.taskId, "task_1");
    assert.deepEqual([coordinator.title, episode.title, cards.title], ["Coordinator", "Episode 2", "Card texts"]);
    assert.deepEqual(cards.peerReceipts, [{ messageId: "m1" }], "other fields stay");
    assert.equal(readFileSync(join(result.data.backup, `local_${sid("c")}.json`), "utf8"), before);
    assert.deepEqual(rails("resume-checkpoint", "--relink", "--json").json().data.linked, [], "a second run changes nothing");
  });

  it("--open opens only the Code tab sessions the app does not have yet, through a terminal, and only for the person", () => {
    const { base, env, root, rails } = family();
    reopen(env, sid("a"), root);
    const bin = join(base, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "script"), `#!/bin/sh\necho "$PWD $*" >> "${join(base, "opened.log")}"\n`);
    chmodSync(join(bin, "script"), 0o755);
    const path = { PATH: `${bin}:${process.env.PATH}` };

    assert.equal(rails("resume-checkpoint", "--open", { ...path, CLAUDECODE: "1" }).code, 2);
    const result = rails("resume-checkpoint", "--open", path);

    assert.equal(result.code, 0, result.text);
    assert.deepEqual(readFileSync(join(base, "opened.log"), "utf8").trim().split("\n").sort(), [
      `${root} -q /dev/null claude --desktop --resume ${sid("b")}`,
      `${root} -q /dev/null claude --desktop --resume ${sid("c")}`,
    ].map((line) => line.replace(root, realpathSync(root))).sort());
  });
});

describe("moku-rails checkpoint keeps the artifacts a session published", () => {
  /** An Artifact publish and its result, as the transcript records them. */
  function publish(id, input, url, { error = false } = {}) {
    return [
      { type: "assistant", timestamp: "2026-11-06T05:00:00.000Z", message: { role: "assistant", content: [{ type: "tool_use", id, name: "Artifact", input }] } },
      {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, is_error: error, content: error ? "Publish refused" : `Published ${input.file_path ?? ""} at ${url} (Version 1)` }] },
        ...(error ? {} : { toolUseResult: { url, path: input.file_path, title: input.title ?? "" } }),
      },
    ];
  }

  it("copies the sources, rebuilds a deleted one from Write and Edit, keeps only the link otherwise, and writes a manifest", () => {
    const { base, env, root, rails } = machine();
    const scratch = join(base, "scratchpad");
    mkdirSync(join(scratch, "data"), { recursive: true });
    writeFileSync(join(scratch, "report.html"), "<title>Report</title>kept");
    writeFileSync(join(scratch, "data", "rows.json"), "[1,2]");
    const gone = join(scratch, "gone.html");
    transcript(env.CLAUDE_CONFIG_DIR, {
      id: ID_CLI,
      cwd: root,
      extra: [
        ...publish("toolu_1", { file_path: join(scratch, "report.html"), title: "Report", files: { "data/rows.json": join(scratch, "data", "rows.json"), "../escape.txt": join(scratch, "report.html") } }, "https://claude.ai/artifact/AAA111"),
        ...call("toolu_w", "Write", { file_path: gone, content: "<h1>Plan v1</h1>" }, "File created"),
        ...call("toolu_e", "Edit", { file_path: gone, old_string: "v1", new_string: "v2" }, "Edited"),
        ...publish("toolu_2", { file_path: gone }, "https://claude.ai/code/artifact/bbb-222"),
        ...publish("toolu_3", { file_path: join(scratch, "never-written.html") }, "https://claude.ai/artifact/CCC333"),
        ...publish("toolu_4", { file_path: join(scratch, "report.html") }, "https://claude.ai/artifact/DDD444", { error: true }),
        ...call("toolu_5", "Artifact", { action: "read", url: "https://claude.ai/artifact/EEE555" }, "<html>someone else's</html>"),
      ],
    });

    const saved = rails("checkpoint", "--include-temp", "--json").json().data;
    const [session] = saved.sessions;
    const byUrl = Object.fromEntries(session.artifacts.map((artifact) => [artifact.url, artifact]));

    assert.deepEqual(Object.keys(byUrl).sort(), ["https://claude.ai/artifact/AAA111", "https://claude.ai/artifact/CCC333", "https://claude.ai/code/artifact/bbb-222"]);
    const report = byUrl["https://claude.ai/artifact/AAA111"];
    assert.equal(report.title, "Report");
    assert.ok(report.dir.startsWith(join(dirname(saved.file), saved.file.split("/").at(-1).replace(/\.json$/, ""), "artifacts", ID_CLI)));
    assert.deepEqual(report.files.map((file) => [file.published, file.status]).sort(), [["data/rows.json", "copied"], ["escape.txt", "copied"], ["report.html", "copied"]]);
    assert.equal(readFileSync(join(report.dir, "data", "rows.json"), "utf8"), "[1,2]");

    const rebuilt = byUrl["https://claude.ai/code/artifact/bbb-222"].files[0];
    assert.equal(rebuilt.status, "restored");
    assert.equal(readFileSync(rebuilt.copy, "utf8"), "<h1>Plan v2</h1>");
    assert.deepEqual(byUrl["https://claude.ai/artifact/CCC333"].files.map((file) => [file.status, file.copy]), [["link-only", null]]);

    const manifest = JSON.parse(readFileSync(join(dirname(report.dir), "manifest.json"), "utf8"));
    assert.deepEqual(manifest.map((entry) => entry.url).sort(), Object.keys(byUrl).sort());
    assert.equal(manifest[0].publishedAt, "2026-11-06T05:00:00.000Z");
    assert.doesNotMatch(readFileSync(saved.file, "utf8"), /Plan v2|sk-do-not-copy/, "the checkpoint holds paths, never the content");

    const resumed = rails("resume-checkpoint").text;
    assert.match(resumed, /artifact: Report https:\/\/claude\.ai\/artifact\/AAA111 → .*artifacts/);
    assert.match(resumed, /bbb-222 → .*rebuilt from the transcript/);
    assert.match(resumed, /CCC333 → link only/);
  });

  it("tells each reopened session where the copies of its artifacts are", () => {
    const { base, env, root, rails } = machine();
    writeFileSync(join(base, "page.html"), "<p>page</p>");
    transcript(env.CLAUDE_CONFIG_DIR, { id: sid("a"), cwd: root, entrypoint: "claude-desktop", extra: publish("toolu_1", { file_path: join(base, "page.html"), title: "Page" }, "https://claude.ai/artifact/PPP") });
    record(env, { id: sid("a"), cwd: root, title: "Designer" });
    rails("checkpoint", ACCOUNT_ENV);
    reopen(env, sid("a"), root);

    const [message] = rails("resume-checkpoint", "--json").json().data.messages;

    assert.equal(message.to, `local_${sid("a")}`);
    assert.match(message.text, /Page: https:\/\/claude\.ai\/artifact\/PPP → .*artifacts/);
  });
});

describe("rebuild", () => {
  it("applies the Edits after the last Write and says when one did not apply", async () => {
    const { rebuild } = await import("../../lib/rails/artifacts.mjs");

    assert.equal(rebuild([{ kind: "edit", input: { old_string: "a", new_string: "b" } }]), undefined);
    assert.deepEqual(rebuild([
      { kind: "write", input: { content: "old" } },
      { kind: "write", input: { content: "x x $& y" } },
      { kind: "edit", input: { old_string: "x", new_string: "z", replace_all: true } },
      { kind: "edit", input: { old_string: "y", new_string: "$1" } },
    ]), { content: "z z $& $1", complete: true });
    assert.deepEqual(rebuild([{ kind: "write", input: { content: "abc" } }, { kind: "edit", input: { old_string: "nope", new_string: "-" } }]), { content: "abc", complete: false });
  });
});
