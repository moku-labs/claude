import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
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
    return { code: run.status, text: `${run.stdout}${run.stderr}`, json: () => JSON.parse(run.stdout || run.stderr.slice(run.stderr.indexOf("{"))) };
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
function record(env, { account = OLD_ACCOUNT, id, localId = `local_old-${id.slice(0, 8)}`, cwd, title = "", archived = false, parent, activity = Date.now(), extra = {} }) {
  const file = join(env.MOKU_DESKTOP_SESSIONS, account, ORG, `${localId}.json`);
  mkdirSync(dirname(file), { recursive: true });
  const data = { sessionId: localId, cliSessionId: id, cwd, title, isArchived: archived, lastActivityAt: activity, model: "claude-opus-5-5", peerReceipts: [{ messageId: "m1" }], ...extra };
  if (parent) data.spawnedFrom = { sessionId: parent, taskId: "task_1", title, sideSession: true, name: "side" };
  writeFileSync(file, JSON.stringify(data));
  return file;
}

/** The app's record of a session opened again under the new account: `local_<cliSessionId>`, a title it made up. */
function reopen(env, id, cwd) {
  return record(env, { account: NEW_ACCOUNT, id, localId: `local_${id}`, cwd, title: "moku: renamed · build" });
}

const ACCOUNT_ENV = { CLAUDE_CODE_ACCOUNT_UUID: OLD_ACCOUNT, CLAUDE_CODE_ORGANIZATION_UUID: ORG };
const NEW_ENV = { CLAUDE_CODE_ACCOUNT_UUID: NEW_ACCOUNT, CLAUDE_CODE_ORGANIZATION_UUID: ORG };

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
    assert.match(text, /not open in the app yet, will be local_c+/);
    assert.match(text, /Not restored: "Card texts" local_c+-1111-4111-8111-111111111111: not in the app yet/);
    assert.deepEqual(resumed.data.steps.filter((step) => step.tool === "run_in_terminal").map((step) => step.input.title), ["moku resume"], "one terminal run opens what is missing");
    assert.match(resumed.data.steps.find((step) => step.tool === "run_in_terminal").input.command, /resume-checkpoint --open/);
    assert.match(text, /set_session_title \{"session_id":"local_b+-1111-4111-8111-111111111111","title":"Episode 2"\}/);
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

  it("--relink leaves a session without its parent while the parent is not open in the app yet", () => {
    const { env, root, rails } = family();
    const cards = reopen(env, sid("c"), root);

    const result = rails("resume-checkpoint", "--relink", "--json").json();

    assert.deepEqual(result.data.linked, []);
    assert.equal(JSON.parse(readFileSync(cards, "utf8")).spawnedFrom, undefined);
    assert.equal(JSON.parse(readFileSync(cards, "utf8")).title, "Card texts", "the title is still set");
    assert.match(result.lines.join("\n"), /2 sessions are not open in the app yet/);
  });

  it("--open opens only the Code tab sessions the app does not have yet, only in a terminal, and checks each in the app's records", () => {
    const { base, env, root, rails } = family();
    reopen(env, sid("a"), root);
    const app = fakeApp(base, env);

    const outside = rails("resume-checkpoint", "--open", { ...app.path, MOKU_FORCE_TTY: "0" });
    assert.equal(outside.code, 2, "the Bash tool is no terminal: refused before anything is touched");
    assert.match(outside.text, /run_in_terminal/);
    assert.equal(existsSync(join(base, "opened.log")), false);

    const result = rails("resume-checkpoint", "--open", "--json", app.path).json();

    assert.equal(result.code, 0, result.lines.join("\n"));
    assert.deepEqual(app.opened().sort(), [sid("b"), sid("c")].sort());
    assert.match(result.lines.join("\n"), /Restore from .*: 3 of 3 Code tab sessions open in the app, nothing left to open/);
    assert.equal(result.data.done, true);
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

/**
 * A stand-in for `script` that plays the desktop app: it logs each open and writes the record the app makes for the
 * session under the new account, with the parent the test says the app restores itself.
 */
function fakeApp(base, env, { nests = [] } = {}) {
  const bin = join(base, "bin");
  mkdirSync(bin, { recursive: true });
  const log = join(base, "opened.log");
  const dir = join(env.MOKU_DESKTOP_SESSIONS, NEW_ACCOUNT, ORG);
  const parents = Object.fromEntries(nests);
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env node
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const argv = process.argv.slice(2);
const id = argv[argv.indexOf("--resume") + 1];
appendFileSync(${JSON.stringify(log)}, id + "\\n");
appendFileSync(${JSON.stringify(log)} + ".argv", argv.join(" ") + "\\n");
mkdirSync(${JSON.stringify(dir)}, { recursive: true });
const parents = ${JSON.stringify(parents)};
const data = { sessionId: "local_" + id, cliSessionId: id, cwd: process.env.FAKE_APP_CWD || process.cwd(), title: "renamed by the app", lastActivityAt: Date.now(), permissionMode: "default" };
if (parents[id]) data.spawnedFrom = { sessionId: parents[id], sideSession: true };
writeFileSync(${JSON.stringify(dir)} + "/local_" + id + ".json", JSON.stringify(data));
`);
  chmodSync(join(bin, "claude"), 0o755);
  return { path: { PATH: `${bin}:${process.env.PATH}`, ...NEW_ENV, MOKU_FORCE_TTY: "1", MOKU_OPEN_WAIT_MS: "2000" }, opened: () => readFileSync(log, "utf8").trim().split("\n"), argv: () => readFileSync(`${log}.argv`, "utf8").trim().split("\n") };
}

/** A repository with a branch checked out in a worktree under `.claude/worktrees/<name>`. */
function worktree(root, name, branch) {
  execFileSync("git", ["-C", root, "add", "-A"]);
  execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "base"]);
  const path = join(root, ".claude", "worktrees", name);
  execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", branch, path]);
  return realpathSync(path);
}

describe("moku-rails --help", () => {
  it("prints the usage of every command and runs none of them", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    const ledger = readFileSync(join(root, ".planning", "state.json"), "utf8");
    const names = ["session", "status", "open", "enter", "done", "skip", "check", "close", "pause", "park", "resume", "adopt", "checkpoint", "resume-checkpoint", "continue", "scope", "stages", "idea", "tier", "waves", "tests", "init", "allow-planning", "guard", "guard-bash", "may-stop"];

    for (const name of names) {
      for (const flag of ["--help", "-h"]) {
        const run = rails(name, flag);
        assert.equal(run.code, 0, `${name} ${flag}: ${run.text}`);
        assert.match(run.text, new RegExp(`^Usage: moku-rails ${name}`), `${name} ${flag}`);
      }
    }

    assert.deepEqual(checkpoints(env), [], "no checkpoint written");
    assert.equal(readFileSync(join(root, ".planning", "state.json"), "utf8"), ledger, "the ledger is untouched");
    assert.match(rails("guard-bash", "ls", "-h").text, /^(?!Usage)/, "a -h inside a guarded command line is the command's, not a request for help");
  });
});

describe("moku-rails checkpoint run twice", () => {
  it("writes no second file when nothing changed, and a new one when something did", () => {
    const { env, root, rails } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });

    const first = rails("checkpoint", "--include-temp", "--json").json().data;
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root, ageHours: 0.01 });
    const again = rails("checkpoint", "--include-temp", "--json").json();

    assert.equal(again.data.unchanged, true);
    assert.equal(again.data.file, first.file);
    assert.match(again.lines[0], /Nothing changed since the checkpoint/);
    assert.deepEqual(checkpoints(env).filter((file) => file.endsWith(".json")), [first.file]);

    writeFileSync(join(root, "second.ts"), "export {};\n");
    // A checkpoint file is named by the second it was saved in
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    const changed = rails("checkpoint", "--include-temp", "--json").json().data;
    assert.equal(changed.unchanged, false);
    assert.equal(checkpoints(env).filter((file) => file.endsWith(".json")).length, 2);
  });
});

describe("moku-rails resume-checkpoint v3: worktrees, one pass, nesting", () => {
  it("keeps a session whose worktree was removed while its branch exists, and names a lost one plainly", () => {
    const { env, root, rails } = machine();
    const cards = worktree(root, "cards", "claude/cards");
    const bugs = worktree(root, "bugs", "claude/bugs");
    for (const [letter, cwd] of [["a", cards], ["b", bugs]]) transcript(env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd, entrypoint: "claude-desktop", folder: letter });
    record(env, { id: sid("a"), cwd: cards, title: "Cards", extra: { branch: "claude/cards", originCwd: realpathSync(root) } });
    record(env, { id: sid("b"), cwd: bugs, title: "Bugs", extra: { branch: "claude/bugs", originCwd: realpathSync(root) } });
    rmSync(cards, { recursive: true, force: true });
    rmSync(bugs, { recursive: true, force: true });
    execFileSync("git", ["-C", root, "worktree", "prune"]);
    execFileSync("git", ["-C", root, "branch", "-q", "-D", "claude/bugs"]);

    const saved = rails("checkpoint", "--json", ACCOUNT_ENV).json().data;

    const kept = saved.sessions.find((session) => session.id === sid("a"));
    assert.equal(kept.folderGone, true);
    assert.equal(kept.branch, "claude/cards");
    assert.equal(kept.repo, realpathSync(root));
    assert.match(saved.skipped.find((entry) => entry.title === "Bugs").reason, /^lost: its folder .*bugs is gone and its branch claude\/bugs no longer exists/);
    assert.match(rails("resume-checkpoint").text, /folder gone: `--open` adds it again from claude\/cards/);
  });

  it("--open adds the worktree again on its branch, opens parents first and prints everything left in one run", () => {
    const { base, env, root, rails } = machine();
    const cards = worktree(root, "cards", "claude/cards");
    for (const [letter, cwd] of [["a", root], ["b", cards], ["c", root]]) transcript(env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd, entrypoint: "claude-desktop", folder: letter, ageHours: letter === "a" ? 2 : 0 });
    // The coordinator's id is already its Claude Code one, so it stays; its side sessions' ids change
    record(env, { id: sid("a"), localId: `local_${sid("a")}`, cwd: root, title: "Coordinator" });
    record(env, { id: sid("b"), cwd: cards, title: "Cards", parent: `local_${sid("a")}`, extra: { branch: "claude/cards", originCwd: realpathSync(root) } });
    record(env, { id: sid("c"), cwd: root, title: "Store", parent: `local_${sid("a")}` });
    rails("checkpoint", ACCOUNT_ENV);
    rmSync(cards, { recursive: true, force: true });
    const app = fakeApp(base, env, { nests: [[sid("c"), `local_${sid("a")}`]] });

    const run = rails("resume-checkpoint", "--open", "--json", app.path).json();

    assert.equal(run.code, 0, run.lines.join("\n"));
    assert.equal(app.opened()[0], sid("a"), "the parent opens first");
    assert.ok(existsSync(cards), "the worktree is back at its old path");
    assert.equal(execFileSync("git", ["-C", cards, "branch", "--show-current"], { encoding: "utf8" }).trim(), "claude/cards");
    const text = run.lines.join("\n");
    assert.match(text, /Added the worktree .*cards again from claude\/cards/);
    assert.doesNotMatch(text, new RegExp(`local_${sid("a")} \\(was local_${sid("a")}\\)`), "an id that stayed is not shown as changed");
    assert.equal(run.data.titles.length, 3, "the app renamed all three");
    assert.deepEqual(run.data.messages.map((message) => message.to).sort(), [`local_${sid("a")}`, `local_${sid("b")}`, `local_${sid("c")}`]);
    const toCoordinator = run.data.messages.find((message) => message.to === `local_${sid("a")}`).text;
    assert.match(toCoordinator, /Your id stays/);
    assert.match(toCoordinator, /Cards: local_old-bbbbbbbb → local_bbbbbbbb/);
    assert.deepEqual(run.data.nesting.nested, [`local_${sid("c")}`]);
    assert.deepEqual(run.data.nesting.unnested.map((entry) => entry.title), ["Cards"]);
    assert.match(text, /osascript -e 'quit app "Claude"'; while pgrep -xq Claude; do sleep 1; done; .*resume-checkpoint --relink .*; open -a Claude/);
    assert.deepEqual(JSON.parse(readFileSync(run.data.actionsFile, "utf8")).titles, run.data.titles);

    // Run again: nothing is opened twice, and the list is the same
    const twice = rails("resume-checkpoint", "--open", "--json", app.path).json();
    assert.equal(app.opened().length, 3);
    assert.match(twice.lines[0], /open in the app already/);
    assert.equal(twice.data.done, true);
  });

  it("sends nothing when no id changed and the app kept the titles and the nesting", () => {
    const { base, env, root, rails } = machine();
    for (const letter of ["a", "c"]) transcript(env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd: root, entrypoint: "claude-desktop", folder: letter });
    record(env, { id: sid("a"), localId: `local_${sid("a")}`, cwd: root, title: "renamed by the app" });
    record(env, { id: sid("c"), localId: `local_${sid("c")}`, cwd: root, title: "renamed by the app", parent: `local_${sid("a")}` });
    rails("checkpoint", ACCOUNT_ENV);
    const app = fakeApp(base, env, { nests: [[sid("c"), `local_${sid("a")}`]] });

    const run = rails("resume-checkpoint", "--open", "--json", app.path).json();

    assert.deepEqual([run.data.titles, run.data.messages, run.data.nesting.unnested], [[], [], []]);
    assert.match(run.lines.join("\n"), /Nothing else to do/);
  });

  it("keeps the branch in the session's own worktree (freeing it sent two sessions to the main checkout on 2026-11-15), and carries files when the app opens it elsewhere", () => {
    const { base, env, root, rails } = machine();
    const old = worktree(root, "f126-old", "claude/f126");
    mkdirSync(join(old, "perf"));
    writeFileSync(join(old, "perf", "run.json"), "{}");
    writeFileSync(join(old, "kept.ts"), "mine");
    transcript(env.CLAUDE_CONFIG_DIR, { id: sid("a"), cwd: old, entrypoint: "claude-desktop", folder: "a" });
    record(env, { id: sid("a"), cwd: old, title: "F126", extra: { branch: "claude/f126", originCwd: realpathSync(root), worktreePath: old } });
    rails("checkpoint", ACCOUNT_ENV);

    // The app opens the session in a worktree of its own
    const moved = join(root, ".claude", "worktrees", "xenodochial");
    execFileSync("git", ["-C", root, "worktree", "add", "-q", "-b", "claude/f126-2", moved]);
    writeFileSync(join(moved, "kept.ts"), "theirs");
    execFileSync("git", ["-C", moved, "add", "kept.ts"]);
    const app = fakeApp(base, env);

    const run = rails("resume-checkpoint", "--open", "--json", { ...app.path, FAKE_APP_CWD: realpathSync(moved) }).json();

    assert.equal(execFileSync("git", ["-C", old, "branch", "--show-current"], { encoding: "utf8" }).trim(), "claude/f126", "the old worktree keeps its branch");
    assert.doesNotMatch(run.lines.join("\n"), /Released/);
    assert.match(run.lines.join("\n"), /"F126" opened in .*xenodochial, not in .*f126-old/);
    assert.equal(run.data.carry.length, 1);
    assert.match(run.data.messages[0].text, /resume-checkpoint --carry/);
    assert.ok(run.data.steps.some((step) => step.tool === "Bash" && /--carry/.test(step.input.command)));

    const carried = rails("resume-checkpoint", "--carry", "--json", { ...NEW_ENV, CLAUDECODE: "1" }).json();

    assert.equal(carried.code, 0);
    assert.deepEqual(carried.data.moved[0].copied, ["perf/run.json"]);
    assert.deepEqual(carried.data.moved[0].kept, ["kept.ts"], "a file that changed in the new folder is left as it is");
    assert.equal(readFileSync(join(moved, "kept.ts"), "utf8"), "theirs");
    assert.ok(existsSync(join(old, "perf", "run.json")), "the old folder keeps its copy");
  });

  it("keeps each session's permission mode, opens it in that mode, and names and writes back a mode the app lost", () => {
    const { base, env, root, rails } = machine();
    const ran = [{ type: "user", permissionMode: "default", message: { role: "user", content: "hi" } }, { type: "user", permissionMode: "auto", message: { role: "user", content: "go" } }];
    transcript(env.CLAUDE_CONFIG_DIR, { id: sid("a"), cwd: root, entrypoint: "claude-desktop", folder: "a", extra: ran });
    // The app's record says default, the transcript says the session ran in auto: the transcript wins
    record(env, { id: sid("a"), cwd: root, title: "Cards", extra: { permissionMode: "default" } });
    const saved = rails("checkpoint", "--json", ACCOUNT_ENV).json().data;
    assert.equal(saved.sessions[0].permissionMode, "auto");
    const app = fakeApp(base, env);

    const run = rails("resume-checkpoint", "--open", "--json", app.path).json();

    assert.match(app.argv()[0], new RegExp(`--resume ${sid("a")} --permission-mode auto$`));
    assert.deepEqual(run.data.modes, [{ sessionId: `local_${sid("a")}`, title: "Cards", saved: "auto", now: "default" }]);
    assert.deepEqual(run.data.steps.find((step) => step.tool === "set_session_permission_mode").input, { session_id: `local_${sid("a")}`, mode: "auto" }, "the session sets the mode back itself, the app stays open");
    assert.doesNotMatch(run.lines.join("\n"), /osascript/, "no Terminal.app step for a mode");

    const relinked = rails("resume-checkpoint", "--relink", "--json").json();
    const file = join(env.MOKU_DESKTOP_SESSIONS, NEW_ACCOUNT, ORG, `local_${sid("a")}.json`);
    assert.deepEqual(relinked.data.moded, [`local_${sid("a")}`]);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).permissionMode, "auto");
    assert.equal(JSON.parse(readFileSync(join(relinked.data.backup, `local_${sid("a")}.json`), "utf8")).permissionMode, "default", "the record as it was is backed up");
    assert.deepEqual(rails("resume-checkpoint", "--json").json().data.modes, [], "nothing left to fix");
  });

  it("--relink refused while the app runs names the one Terminal.app line", () => {
    const { env, root, rails } = family3(machine());
    reopen(env, sid("a"), root);

    const refused = rails("resume-checkpoint", "--relink", { MOKU_DESKTOP_RUNNING: "1" });

    assert.equal(refused.code, 2);
    assert.match(refused.text, /Terminal\.app/);
    assert.match(refused.text, /osascript -e 'quit app "Claude"'.*--relink.*open -a Claude/);
  });
});

/** A coordinator with one side session, saved under the old account. */
function family3(m) {
  for (const letter of ["a", "b"]) transcript(m.env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd: m.root, entrypoint: "claude-desktop", folder: letter });
  record(m.env, { id: sid("a"), cwd: m.root, title: "Coordinator" });
  record(m.env, { id: sid("b"), cwd: m.root, title: "Side", parent: `local_old-${sid("a").slice(0, 8)}` });
  m.rails("checkpoint", ACCOUNT_ENV);
  return m;
}

/** Three generations saved under the old account, as in the suite above: a coordinator, its side session, and that one's. */
function family() {
  const m = machine();
  for (const letter of ["a", "b", "c"]) transcript(m.env.CLAUDE_CONFIG_DIR, { id: sid(letter), cwd: m.root, entrypoint: "claude-desktop" });
  record(m.env, { id: sid("a"), cwd: m.root, title: "Coordinator" });
  record(m.env, { id: sid("b"), cwd: m.root, title: "Episode 2", parent: `local_old-${sid("a").slice(0, 8)}` });
  record(m.env, { id: sid("c"), cwd: m.root, title: "Card texts", parent: `local_old-${sid("b").slice(0, 8)}` });
  m.rails("checkpoint", ACCOUNT_ENV);
  return m;
}

describe("moku-rails resume-checkpoint v4: the restores of 2026-11-11 and 2026-11-15", () => {
  it("takes no record of another account for an open session: only the current sign-in's records count", () => {
    const { env, root, rails } = family();
    // An earlier sign-in kept records of the same sessions (11-11: five sessions were taken as open from such a folder)
    for (const letter of ["a", "b"]) record(env, { account: OTHER_ACCOUNT, id: sid(letter), localId: `local_${sid(letter)}`, cwd: root, activity: 1 });
    mkdirSync(join(env.MOKU_DESKTOP_SESSIONS, NEW_ACCOUNT, ORG), { recursive: true });

    const resumed = rails("resume-checkpoint", "--json", NEW_ENV).json();

    assert.deepEqual(resumed.data.sessions.map((session) => session.state), ["missing", "missing", "missing"]);
    assert.equal(resumed.data.done, false);
    assert.equal(resumed.data.steps.filter((step) => step.tool === "run_in_terminal").length, 1);
  });

  it("names a session the current account keeps archived, and brings it back with unarchive_session, not --open", () => {
    const { env, root, rails } = family();
    // 11-15: the account had old archived records of the coordinator and the store from an earlier sign-in
    record(env, { account: NEW_ACCOUNT, id: sid("a"), localId: `local_${sid("a")}`, cwd: root, title: "Coordinator", archived: true });
    record(env, { account: NEW_ACCOUNT, id: sid("b"), localId: `local_${sid("b")}`, cwd: root, title: "Episode 2" });
    writeFileSync(join(env.MOKU_DESKTOP_SESSIONS, NEW_ACCOUNT, ORG, "archived-sessions.idx"), JSON.stringify({ v: 1, archived: [`local_${sid("b")}`] }));

    const resumed = rails("resume-checkpoint", "--json", NEW_ENV).json();

    const state = Object.fromEntries(resumed.data.sessions.map((session) => [session.id, session.state]));
    assert.deepEqual(state, { [sid("a")]: "archived", [sid("b")]: "archived", [sid("c")]: "missing" });
    assert.deepEqual(resumed.data.steps.filter((step) => step.tool === "unarchive_session").map((step) => step.input.session_id).sort(), [`local_${sid("a")}`, `local_${sid("b")}`]);
    assert.match(resumed.lines.join("\n"), /Not restored: "Coordinator" .*archived in this account: unarchive_session brings it back/);
    assert.equal(resumed.data.messages.length, 0, "no message goes to a session that cannot take it yet");
  });

  it("restores into the account the sessions were saved from: their records under the old ids count", () => {
    const { rails } = family();

    const resumed = rails("resume-checkpoint", "--json", ACCOUNT_ENV).json();

    assert.equal(resumed.data.done, true);
    assert.deepEqual(resumed.data.sessions.map((session) => session.newId), ["a", "b", "c"].map((letter) => `local_old-${sid(letter).slice(0, 8)}`));
    assert.deepEqual(resumed.data.steps, []);
  });

  it("does not call a session opened when the app wrote no record of it, whatever the command's exit code", () => {
    const { base, env, rails } = family();
    const bin = join(base, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "claude"), "#!/bin/sh\necho \"Opening session in Claude Desktop\"\n");
    chmodSync(join(bin, "claude"), 0o755);

    const run = rails("resume-checkpoint", "--open", "--json", { PATH: `${bin}:${process.env.PATH}`, ...NEW_ENV, MOKU_FORCE_TTY: "1", MOKU_OPEN_WAIT_MS: "300" }).json();

    assert.equal(run.code, 1);
    assert.equal(run.data.opened, 0);
    assert.match(run.data.failed[0].why, /the app wrote no record of it/);
    assert.match(run.lines.join("\n"), /Restore from .*: 0 of 3/);
  });

  it("is safe to run again: a delivered message is not listed twice, and a finished resume has no step left", () => {
    const { base, env, rails } = family();
    const app = fakeApp(base, env, { nests: [[sid("b"), `local_${sid("a")}`], [sid("c"), `local_${sid("b")}`]] });
    rails("resume-checkpoint", "--open", app.path);

    const first = rails("resume-checkpoint", "--json", NEW_ENV).json();
    assert.ok(first.data.steps.some((step) => step.tool === "send_message"));
    assert.ok(first.data.steps.some((step) => step.tool === "Bash" && /--sent/.test(step.input.command)));
    assert.equal(rails("resume-checkpoint", "--sent", "--json", NEW_ENV).json().data.marked.length, first.data.messages.length);

    // The titles are set back, as the session does with set_session_title
    for (const letter of ["a", "b", "c"]) {
      const file = join(env.MOKU_DESKTOP_SESSIONS, NEW_ACCOUNT, ORG, `local_${sid(letter)}.json`);
      const title = { a: "Coordinator", b: "Episode 2", c: "Card texts" }[letter];
      writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), title }));
    }

    const again = rails("resume-checkpoint", "--json", NEW_ENV).json();
    assert.deepEqual(again.data.steps, []);
    assert.equal(again.data.done, true);
    assert.match(again.lines.join("\n"), /No step left for the session/);
  });

  it("counts a side session the app moved to the top level as not nested, and --relink clears that flag", () => {
    const { env, root, rails } = family3(machine());
    reopen(env, sid("a"), root);
    const side = record(env, { account: NEW_ACCOUNT, id: sid("b"), localId: `local_${sid("b")}`, cwd: root, title: "Side", parent: `local_${sid("a")}`, extra: { lineageDetached: true, lineageDetachedBy: "user" } });

    const resumed = rails("resume-checkpoint", "--json").json();
    assert.deepEqual(resumed.data.nesting.unnested.map((entry) => entry.title), ["Side"]);
    assert.match(resumed.lines.join("\n"), /ask the person first.*--relink-in-terminal/);
    assert.match(rails("resume-checkpoint", "--relink-in-terminal", { MOKU_DRY_RUN: "1" }).text, /Would run in Terminal\.app: osascript -e 'quit app "Claude"'/);

    rails("resume-checkpoint", "--relink");
    const written = JSON.parse(readFileSync(side, "utf8"));
    assert.equal(written.lineageDetached, undefined);
    assert.equal(written.spawnedFrom.sessionId, `local_${sid("a")}`);
  });

  it("restores from the newest checkpoint of another account, so one the new sign-in writes on its own never hides it", () => {
    const { env, root, rails } = family();
    const before = checkpoints(env).filter((file) => file.endsWith(".json"));
    reopen(env, sid("a"), root);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    rails("checkpoint", "--auto", NEW_ENV);
    assert.equal(checkpoints(env).filter((file) => file.endsWith(".json")).length, 2, "the new account's own checkpoint is written");

    assert.equal(rails("resume-checkpoint", "--json", NEW_ENV).json().data.file, before[0]);
  });

  it("keeps a checkpoint on its own at the end of a turn, at most once in the interval, and prunes only automatic ones", () => {
    const { env, root } = machine();
    transcript(env.CLAUDE_CONFIG_DIR, { id: ID_CLI, cwd: root });
    const stop = () => spawnSync("node", [join(dirname(CLI), "..", "hooks", "on-stop.mjs")], { input: JSON.stringify({ session_id: "s1", cwd: root }), encoding: "utf8", env: { ...env, MOKU_AUTO_CHECKPOINT: "1" } });

    stop();
    const deadline = Date.now() + 10_000;
    while (checkpoints(env).filter((file) => file.endsWith(".json")).length === 0 && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    const written = checkpoints(env).filter((file) => file.endsWith(".json"));
    assert.equal(written.length, 1, "the Stop hook started a checkpoint in the background");
    assert.equal(JSON.parse(readFileSync(written[0], "utf8")).auto, true);
    assert.equal(JSON.parse(readFileSync(written[0], "utf8")).sessions[0].id, ID_CLI);

    writeFileSync(join(root, "more.ts"), "export {};\n");
    stop();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    assert.equal(checkpoints(env).filter((file) => file.endsWith(".json")).length, 1, "a second turn inside the interval starts none");
  });
});
