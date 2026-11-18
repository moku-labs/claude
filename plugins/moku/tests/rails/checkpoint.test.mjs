import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

const OLD = "87615095-old-account/a7e3f63d-org";
const NEW = "519d6a7b-new-account/0387cbe6-org";

/**
 * A machine with the desktop app's files laid out as the app keeps them: per-account records, the archive index,
 * the worktree registry, and transcripts. Nothing here touches the real app.
 */
function machine() {
  const base = mkdtempSync(join(tmpdir(), "moku-sessions-"));
  const sessions = join(base, "Claude", "claude-code-sessions");
  const registry = join(base, "Claude", "git-worktrees.json");
  const projects = join(base, "config", "projects");
  mkdirSync(sessions, { recursive: true });
  writeFileSync(registry, JSON.stringify({ worktrees: {}, schemaVersion: 2, pendingTombstones: [] }));

  // A stand-in for `claude --desktop --resume`: like the app on 2026-11-18, it writes a record with the folder it
  // ran in, the default mode, an automatic title, and no worktree, parent or lease; it refuses --permission-mode
  const bin = join(base, "fake-claude.mjs");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(base, "claude-calls.log"))}, JSON.stringify({ args, cwd: process.cwd() }) + "\\n");
if (args.includes("--permission-mode")) { console.error("Error: --desktop can't be combined with --permission-mode"); process.exit(1); }
const cli = args[args.indexOf("--resume") + 1];
const dir = join(process.env.MOKU_DESKTOP_SESSIONS, process.env.MOKU_DESKTOP_ACCOUNT);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "local_" + cli + ".json"), JSON.stringify({ sessionId: "local_" + cli, cliSessionId: cli, cwd: process.cwd(), originCwd: process.cwd(), title: "Auto title", titleSource: "auto", permissionMode: "default", isArchived: false, lastActivityAt: Date.now(), adoptedFromOtherSurface: true, fromCliTranscript: true }));
`,
  );
  chmodSync(bin, 0o755);

  const env = {
    ...process.env,
    MOKU_HOME: join(base, "home", ".claude", "moku"),
    MOKU_DESKTOP_SESSIONS: sessions,
    MOKU_TRANSCRIPTS: projects,
    MOKU_DESKTOP_ACCOUNT: OLD,
    MOKU_DESKTOP_RUNNING: "0",
    MOKU_CLAUDE_BIN: bin,
    MOKU_OPEN_PAUSE_MS: "0",
    MOKU_OPEN_WAIT_MS: "3000",
    CLAUDE_CODE_SESSION_ID: "self-old",
  };
  const rails = (/** @type {any[]} */ ...args) => {
    const extra = typeof args.at(-1) === "object" ? args.pop() : {};
    const run = spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { ...env, ...extra }, cwd: base });
    const out = `${run.stdout}${run.stderr}`;
    return { code: run.status, text: out, json: () => JSON.parse(run.stdout || run.stderr) };
  };
  const dir = (/** @type {string} */ key) => join(sessions, key);
  const read = (/** @type {string} */ key, /** @type {string} */ id) => JSON.parse(readFileSync(join(dir(key), `${id}.json`), "utf8"));
  const write = (/** @type {string} */ key, /** @type {Record<string, any>} */ data) => {
    mkdirSync(dir(key), { recursive: true });
    writeFileSync(join(dir(key), `${data.sessionId}.json`), JSON.stringify(data));
  };
  const leases = () => JSON.parse(readFileSync(registry, "utf8")).worktrees;
  const calls = () => (existsSync(join(base, "claude-calls.log")) ? readFileSync(join(base, "claude-calls.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  const checkpoints = () => {
    const folder = join(base, "home", ".claude", "moku-checkpoints");
    return existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".json")) : [];
  };

  return { base, env, rails, dir, read, write, registry, leases, projects, calls, checkpoints };
}

/**
 * A record in the shape the app writes (2026-11-18): folder fields, lineage fields, mode and title.
 *
 * @param {{ id: string, cli?: string, title: string, cwd: string, parent?: string, worktree?: string, branch?: string, archived?: boolean, mode?: string, detached?: boolean, at?: number }} options
 */
function appRecord({ id, cli = id.replace(/^local_/, ""), title, cwd, parent, worktree, branch = "", archived = false, mode = "auto", detached = false, at = Date.now() }) {
  const origin = worktree ? cwd.replace(/\/\.claude\/worktrees\/.*$/, "") : cwd;
  return {
    sessionId: id,
    cliSessionId: cli,
    cwd,
    originCwd: origin,
    folderPlace: { cwd, realPath: cwd, ...(worktree ? { origin: { cwd: origin, realPath: origin } } : {}) },
    gitAnchors: [{ gitRoot: origin, commonDir: `${origin}/.git` }],
    title,
    titleSource: "user",
    permissionMode: mode,
    isArchived: archived,
    lastActivityAt: at,
    ...(branch ? { branch, sourceBranch: "main" } : {}),
    ...(worktree ? { worktreePath: cwd, worktreeName: worktree } : {}),
    ...(parent ? { spawnedFrom: { sessionId: parent, taskId: `task_${cli.slice(0, 6)}`, title, sideSession: true, name: title.toLowerCase().replace(/\W+/g, "-") }, startChain: { firstSessionId: parent, depth: 1 }, spawnSeed: { worktreeHookBased: Boolean(worktree) } } : {}),
    ...(detached ? { lineageDetached: true, lineageDetachedBy: "user" } : {}),
    pendingSystemReminder: "conversation text that is never copied",
    remoteMcpServersConfig: [],
  };
}

/**
 * The sidebar of 2026-11-18 under the old account, folders on disk: a coordinator with F126 in a worktree, a game
 * with five side sessions (three in worktrees, one two levels deep, one sharing the game's folder), the session that
 * saves, an archived session sharing the album's worktree, and a terminal-only transcript.
 */
function sidebar(m) {
  const game = join(m.base, "projects", "memory_missing");
  const engine = join(m.base, "projects", "moku_game");
  const wt = (/** @type {string} */ repo, /** @type {string} */ name) => join(repo, ".claude", "worktrees", name);
  for (const folder of [game, engine, wt(game, "board-bugs"), wt(game, "season"), wt(game, "reward"), wt(engine, "meitner")]) mkdirSync(folder, { recursive: true });

  const sessions = [
    appRecord({ id: "local_old-coord", cli: "coord", title: "Координатор: движок и редактор", cwd: engine }),
    appRecord({ id: "local_f126old", cli: "f126", title: "F126 этап 4", cwd: wt(engine, "meitner"), worktree: "meitner", branch: "claude/rubin", parent: "local_old-coord", mode: "default" }),
    appRecord({ id: "local_old-game", cli: "game", title: "Игра: A Memory Missing", cwd: game }),
    appRecord({ id: "local_old-album", cli: "album", title: "Альбом карточек", cwd: wt(game, "board-bugs"), worktree: "board-bugs", branch: "moku/album", parent: "local_old-game" }),
    appRecord({ id: "local_old-season", cli: "season", title: "Сезон пробуждения", cwd: wt(game, "season"), worktree: "season", branch: "moku/season", parent: "local_old-game" }),
    appRecord({ id: "local_old-reward", cli: "reward", title: "Reward containers", cwd: wt(game, "reward"), worktree: "reward", branch: "moku/reward", parent: "local_old-season" }),
    appRecord({ id: "local_old-store", cli: "store", title: "Store", cwd: game, parent: "local_old-game" }),
    appRecord({ id: "local_saver", cli: "self-old", title: "Сохранение сессий", cwd: m.base }),
    appRecord({ id: "local_items", cli: "items", title: "Внедрение новых предметов", cwd: wt(game, "board-bugs"), worktree: "board-bugs", branch: "moku/album", parent: "local_old-game", archived: true }),
  ];
  for (const record of sessions) m.write(OLD, record);
  writeFileSync(join(m.dir(OLD), "archived-sessions.idx"), JSON.stringify({ v: 1, archived: ["local_items"] }));
  writeFileSync(m.registry, JSON.stringify({ worktrees: { "board-bugs": { name: "board-bugs", leasedBy: "local_old-album", branch: "moku/album" }, season: { name: "season", leasedBy: "local_old-season" }, reward: { name: "reward", leasedBy: "local_old-reward" }, meitner: { name: "meitner", leasedBy: "local_f126old" } } }));

  for (const record of sessions) {
    mkdirSync(join(m.projects, "folder"), { recursive: true });
    writeFileSync(join(m.projects, "folder", `${record.cliSessionId}.jsonl`), '{"type":"user","message":{"content":"token sk-never-copied"}}\n');
  }
  return { game, engine, wt };
}

describe("moku-rails checkpoint: exactly the sidebar, only on request", () => {
  it("saves the sessions that are not archived, with their nesting, and nothing of another account", () => {
    const m = machine();
    sidebar(m);
    // 2026-11-11: an old account's records of the same sessions, and a stray one, were taken as open
    m.write(NEW, appRecord({ id: "local_stray", title: "Другой аккаунт", cwd: m.base }));
    m.write(NEW, appRecord({ id: "local_game2", cli: "game", title: "Игра (старая запись)", cwd: m.base }));

    const run = m.rails("checkpoint", "--json");
    assert.equal(run.code, 0, run.text);
    const saved = JSON.parse(readFileSync(run.json().data.file, "utf8"));

    assert.equal(saved.version, 3);
    assert.equal(saved.account, OLD);
    assert.deepEqual(saved.sessions.map((session) => session.title), ["Игра: A Memory Missing", "Store", "Альбом карточек", "Сезон пробуждения", "Reward containers", "Координатор: движок и редактор", "F126 этап 4", "Сохранение сессий"]);
    assert.equal(saved.sessions.find((session) => session.cli === "reward").parent, "local_old-season");
    assert.equal(saved.sessions.find((session) => session.cli === "f126").mode, "default");
    assert.deepEqual(saved.leases, { "board-bugs": "local_old-album", season: "local_old-season", reward: "local_old-reward", meitner: "local_f126old" });
    assert.doesNotMatch(readFileSync(run.json().data.file, "utf8"), /sk-never-copied|never copied/);
  });

  it("prints the tree as the sidebar nests it and says what it left out", () => {
    const m = machine();
    sidebar(m);
    const text = m.rails("checkpoint").text;

    assert.match(text, /Saved the 8 sessions of the sidebar/);
    assert.match(text, /\n- "Игра: A Memory Missing"[^\n]*\n {2}- "Store"[^\n]*\n {2}- "Альбом карточек"[^\n]*\n {2}- "Сезон пробуждения"[^\n]*\n {4}- "Reward containers"/);
    assert.match(text, /Left out: 1 archived session of this account/);
  });

  it("puts a side session whose parent is archived, or that the person detached, at the top", () => {
    const m = machine();
    m.write(OLD, appRecord({ id: "local_gone", title: "Archived parent", cwd: m.base, archived: true }));
    m.write(OLD, appRecord({ id: "local_orphan", title: "Orphan", cwd: m.base, parent: "local_gone" }));
    m.write(OLD, appRecord({ id: "local_top", title: "Top", cwd: m.base }));
    m.write(OLD, appRecord({ id: "local_free", title: "Detached", cwd: m.base, parent: "local_top", detached: true }));

    const saved = JSON.parse(readFileSync(m.rails("checkpoint", "--json").json().data.file, "utf8"));
    assert.deepEqual(saved.sessions.map((session) => [session.title, session.parent]), [["Detached", null], ["Orphan", null], ["Top", null]]);
  });

  it("leaves out the sessions named with --drop", () => {
    const m = machine();
    sidebar(m);
    const saved = JSON.parse(readFileSync(m.rails("checkpoint", "--drop", "local_saver,store", "--json").json().data.file, "utf8"));
    assert.equal(saved.sessions.length, 6);
    assert.ok(!saved.sessions.some((session) => session.cli === "store" || session.cli === "self-old"));
  });

  it("never saves on its own: the Stop hook and a sign-in phrase write no checkpoint", () => {
    const m = machine();
    sidebar(m);
    const hook = (/** @type {string} */ name, /** @type {Record<string, any>} */ input) => spawnSync("node", [join(dirname(CLI), "..", "hooks", name)], { input: JSON.stringify(input), encoding: "utf8", env: m.env });

    hook("on-stop.mjs", { session_id: "s1", cwd: m.base });
    const signIn = hook("on-prompt.mjs", { session_id: "s1", cwd: m.base, prompt: "сейчас перелогинюсь на другой аккаунт" });

    assert.deepEqual(m.checkpoints(), []);
    assert.doesNotMatch(signIn.stdout, /checkpoint/);
  });
});

describe("moku-rails resume-checkpoint: the sidebar back, exactly", () => {
  /** Save under the old account, then sign in to the new one, which keeps records from an earlier trip. */
  function signedInAgain() {
    const m = machine();
    const folders = sidebar(m);
    const file = m.rails("checkpoint", "--json").json().data.file;
    const env = { MOKU_DESKTOP_ACCOUNT: NEW, CLAUDE_CODE_SESSION_ID: "self-new" };

    // 2026-11-15 and 2026-11-18: the new account kept F126 archived under another local id, a stale session that
    // shares the album's worktree, and the session that runs the restore
    m.write(NEW, appRecord({ id: "local_f126new", cli: "f126", title: "F126 этап 4", cwd: folders.wt(folders.engine, "f162"), archived: true, at: 1 }));
    m.write(NEW, appRecord({ id: "local_items2", cli: "items", title: "Внедрение новых предметов", cwd: folders.wt(folders.game, "board-bugs"), worktree: "board-bugs" }));
    m.write(NEW, appRecord({ id: "local_restorer", cli: "self-new", title: "Восстановление сессии", cwd: m.base }));
    writeFileSync(join(m.dir(NEW), "archived-sessions.idx"), JSON.stringify({ v: 1, archived: ["local_f126new"] }));
    return { m, file, env, folders };
  }

  /** What the app does on unarchive_session. */
  function unarchive(m, id) {
    const record = m.read(NEW, id);
    m.write(NEW, { ...record, isArchived: false });
    const index = JSON.parse(readFileSync(join(m.dir(NEW), "archived-sessions.idx"), "utf8"));
    writeFileSync(join(m.dir(NEW), "archived-sessions.idx"), JSON.stringify({ ...index, archived: index.archived.filter((entry) => entry !== id) }));
  }

  it("plans the live phase first: unarchive what the account archived, open the rest in the Terminal panel", () => {
    const { m, env } = signedInAgain();
    const data = m.rails("resume-checkpoint", "--json", env).json().data;

    assert.equal(data.done, false);
    assert.deepEqual(data.steps.map((step) => step.tool), ["unarchive_session", "run_in_terminal", "Bash"]);
    assert.equal(data.steps[0].input.session_id, "local_f126new");
    assert.match(data.steps[1].input.command, /resume-checkpoint --open .* --account '519d6a7b-new-account\/0387cbe6-org'/);
    assert.equal(data.offline.needed, false, "nothing is written while sessions are still missing");
    assert.deepEqual(data.extra.map((entry) => entry.title), ["Внедрение новых предметов"], "the session that runs the restore is never extra");
  });

  it("--open refuses outside a terminal and changes nothing", () => {
    const { m, env } = signedInAgain();
    const run = m.rails("resume-checkpoint", "--open", { ...env, MOKU_FORCE_TTY: "0" });
    assert.equal(run.code, 2);
    assert.match(run.text, /needs a terminal/);
    assert.deepEqual(m.calls(), []);
  });

  it("restores the 2026-11-18 sidebar end to end: open, one restart, messages, and only then \"Restored\"", () => {
    const { m, env, folders } = signedInAgain();
    unarchive(m, "local_f126new");

    // Phase 1: open the missing sessions, parents first, never with --permission-mode
    const opened = m.rails("resume-checkpoint", "--open", { ...env, MOKU_FORCE_TTY: "1" });
    assert.equal(opened.code, 0, opened.text);
    assert.match(opened.text, /^Opened 7 of 7 sessions/);
    const order = m.calls().map((call) => call.args[2]);
    assert.ok(order.indexOf("game") < order.indexOf("season") && order.indexOf("season") < order.indexOf("reward"), order.join(","));
    assert.ok(m.calls().every((call) => !call.args.includes("--permission-mode")));
    assert.equal(m.calls().find((call) => call.args[2] === "reward").cwd, realpathSync(folders.wt(folders.game, "reward")));

    // Phase 2: what only the app's files hold, after one question
    const planned = m.rails("resume-checkpoint", "--json", env).json().data;
    assert.equal(planned.done, false);
    assert.deepEqual(planned.steps.map((step) => step.tool), ["AskUserQuestion", "Bash"]);
    assert.match(planned.steps[0].input.question, /quit and open again.*nesting.*worktree leases.*permission modes.*archive flag of 1 session not in the checkpoint \("Внедрение новых предметов"; its folder stays\)/s);
    assert.match(planned.steps[1].input.command, /--offline-in-terminal .* --self 'self-new'/);
    const reward = planned.sessions.find((entry) => entry.title === "Reward containers");
    assert.match(reward.problems.join("\n"), /not nested under "Сезон пробуждения"/);
    assert.match(reward.problems.join("\n"), /worktree reward is leased to local_old-reward/);
    assert.match(reward.problems.join("\n"), /permission mode default, was auto/);

    const script = m.rails("resume-checkpoint", "--offline-in-terminal", "--json", { ...env, MOKU_DRY_RUN: "1" }).json().data.script;
    assert.match(script, /quit app "Claude"[\s\S]*resume-checkpoint --offline .* --account '519d6a7b-new-account\/0387cbe6-org' --self 'self-new'[\s\S]*open -a Claude/);

    const running = m.rails("resume-checkpoint", "--offline", { ...env, MOKU_DESKTOP_RUNNING: "1" });
    assert.equal(running.code, 2);
    assert.match(running.text, /app is running/);
    assert.equal(m.read(NEW, "local_reward").spawnedFrom, undefined, "nothing written while the app runs");
    assert.equal(m.read(NEW, "local_reward").title, "Auto title");

    const guessed = m.rails("resume-checkpoint", "--offline", { CLAUDE_CODE_SESSION_ID: "", MOKU_DESKTOP_ACCOUNT: "" });
    assert.equal(guessed.code, 2, "outside the app, --offline never guesses the account");
    assert.match(guessed.text, /--account/);

    const applied = m.rails("resume-checkpoint", "--offline", "--account", NEW, "--self", "self-new", { CLAUDE_CODE_SESSION_ID: "" });
    assert.equal(applied.code, 0, applied.text);
    assert.match(applied.text, /The files as they were are in .*backup-/);

    // The app's files now: nesting with the new ids, the worktree folders, the leases, the modes, the titles
    assert.equal(m.read(NEW, "local_reward").spawnedFrom.sessionId, "local_season");
    assert.equal(m.read(NEW, "local_reward").startChain.firstSessionId, "local_season");
    assert.equal(m.read(NEW, "local_season").spawnedFrom.sessionId, "local_game");
    assert.equal(m.read(NEW, "local_store").spawnedFrom.sessionId, "local_game");
    assert.equal(m.read(NEW, "local_f126new").spawnedFrom.sessionId, "local_coord");
    assert.equal(m.read(NEW, "local_f126new").cwd, folders.wt(folders.engine, "meitner"));
    assert.equal(m.read(NEW, "local_f126new").worktreeName, "meitner");
    assert.equal(m.read(NEW, "local_f126new").permissionMode, "default");
    assert.equal(m.read(NEW, "local_album").worktreeName, "board-bugs");
    assert.equal(m.read(NEW, "local_album").permissionMode, "auto");
    assert.equal(m.read(NEW, "local_album").title, "Альбом карточек");
    assert.equal(m.read(NEW, "local_game").spawnedFrom, undefined, "a top-level session stays at the top");
    assert.deepEqual(Object.fromEntries(Object.entries(m.leases()).map(([name, entry]) => [name, entry.leasedBy])), { "board-bugs": "local_album", season: "local_season", reward: "local_reward", meitner: "local_f126new" });
    // The stale session sharing the album's worktree: archived by its flag, its folder kept
    assert.equal(m.read(NEW, "local_items2").isArchived, true);
    assert.ok(JSON.parse(readFileSync(join(m.dir(NEW), "archived-sessions.idx"), "utf8")).archived.includes("local_items2"));
    assert.ok(existsSync(folders.wt(folders.game, "board-bugs")));
    assert.equal(m.read(NEW, "local_restorer").isArchived, false, "the session that runs the restore stays");
    assert.match(m.rails("resume-checkpoint", "--offline", "--account", NEW, "--self", "self-new").text, /nothing written/, "a second run writes nothing");

    // Phase 3: messages about the ids that changed, then done
    const after = m.rails("resume-checkpoint", "--json", env).json().data;
    assert.equal(after.done, false);
    // Every id changed (the old ones were the old account's): one message each, the parents' with their children's
    assert.deepEqual(after.steps.map((step) => step.tool), [...Array(8).fill("send_message"), "Bash"]);
    assert.match(after.steps.find((step) => step.input.session_id === "local_coord").input.message, /your id changed: local_coord \(was local_old-coord\)[\s\S]*F126 этап 4: local_f126old → local_f126new/);
    assert.match(after.steps.find((step) => step.input.session_id === "local_game").input.message, /Store: local_old-store → local_store/);
    m.rails("resume-checkpoint", "--sent", env);

    const final = m.rails("resume-checkpoint", "--json", env);
    assert.equal(final.json().data.done, true, final.text);
    assert.deepEqual(final.json().data.steps, []);
    assert.match(m.rails("resume-checkpoint", env).text, /^Restored: all 8 sessions .* as saved, nothing extra\./);
  });

  it("never says \"Restored\" while a session cannot come back, and says which and why", () => {
    const { m, env } = signedInAgain();
    rmSync(join(m.projects, "folder", "store.jsonl"));
    const file = m.rails("checkpoint", "--json", { ...env, MOKU_DESKTOP_ACCOUNT: OLD }).json().data.file;
    const run = m.rails("resume-checkpoint", file, env);

    assert.match(run.text, /^Restore of .*: 0 of 8 sessions as saved; not done yet\./);
    assert.match(run.text, /NOT YET "Store" \(not in the app\): its transcript is not on this machine/);
    assert.equal(m.rails("resume-checkpoint", file, "--json", env).json().data.done, false);
  });

  it("brings a removed worktree back from its branch before it opens the session", () => {
    const { m, env, folders } = signedInAgain();
    const repo = folders.game;
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    execFileSync("git", ["-C", repo, "commit", "-q", "--allow-empty", "-m", "init"]);
    execFileSync("git", ["-C", repo, "branch", "moku/season"]);
    rmSync(folders.wt(repo, "season"), { recursive: true });
    unarchive(m, "local_f126new");

    const opened = m.rails("resume-checkpoint", "--open", { ...env, MOKU_FORCE_TTY: "1" });
    assert.equal(opened.code, 0, opened.text);
    assert.match(opened.text, /Added the worktree .*season again from moku\/season/);
    assert.equal(execFileSync("git", ["-C", folders.wt(repo, "season"), "branch", "--show-current"], { encoding: "utf8" }).trim(), "moku/season");
  });

  it("back in the same account, only unarchives: no restart, no message", () => {
    const m = machine();
    sidebar(m);
    m.rails("checkpoint");
    const album = m.read(OLD, "local_old-album");
    m.write(OLD, { ...album, isArchived: true });

    const data = m.rails("resume-checkpoint", "--json").json().data;
    assert.deepEqual(data.steps.map((step) => [step.tool, step.input.session_id]), [["unarchive_session", "local_old-album"], ["Bash", undefined]]);
    m.write(OLD, album);
    assert.equal(m.rails("resume-checkpoint", "--json").json().data.done, true);
  });

  it("sets a title the app changed with the tool when nothing else needs a restart", () => {
    const m = machine();
    sidebar(m);
    m.rails("checkpoint");
    m.write(OLD, { ...m.read(OLD, "local_old-store"), title: "Renamed by the app" });

    const data = m.rails("resume-checkpoint", "--json").json().data;
    assert.deepEqual(data.steps, [{ tool: "set_session_title", input: { session_id: "local_old-store", title: "Store" }, why: "the app renamed it" }]);
  });

  it("reads only checkpoints of this version: an older file asks for a new save", () => {
    const m = machine();
    const folder = join(m.base, "home", ".claude", "moku-checkpoints");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "2026-11-17T18-42-52Z.json"), JSON.stringify({ version: 2, sessions: [] }));
    const run = m.rails("resume-checkpoint", join(folder, "2026-11-17T18-42-52Z.json"));
    assert.equal(run.code, 2);
    assert.match(run.text, /not a checkpoint of this version: save the sessions again/);
    assert.match(m.rails("resume-checkpoint").text, /never saved here/);
  });
});
