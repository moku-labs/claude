/**
 * Checkpoint: keep the progress of every open moku session on this machine, so each one continues after the
 * person signs in again, in any way (an API key, a Team account, another sign-in).
 *
 * One concern: on request, write a checkpoint of the open sessions, and turn it back into the steps that continue
 * each one: the command, the id it gets under the new sign-in, its title, its parent and its artifacts. The sign-in
 * itself is the person's: no token, no Keychain, no credentials file is read or written here.
 *
 * Which sessions are open comes from the desktop app's records of the current account: every Code tab session that
 * is not archived, at any age. Terminal sessions, which the app does not know, count when they worked on the rails
 * lately. What a session did comes from its transcript: the first lines name its cwd and where it runs, its tool
 * calls say which background tasks it started and which artifacts it published. Only the description of an
 * unfinished task and copies of the session's own artifacts are kept; nothing of the conversation is copied.
 */

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";

import { mokuHome, rootForSession } from "../hooks/root.mjs";
import { saveArtifacts } from "./artifacts.mjs";
import { desktopRoot, readRecords, reopenedRecord } from "./desktop.mjs";
import { loadLedger } from "./ledger.mjs";
import { routeFor } from "./routes.mjs";

/**
 * @typedef {object} SavedChange
 * @property {string} id
 * @property {string} title
 * @property {string} size
 * @property {string | null} station the station it is inside, or null between stations
 * @property {string} next a short line on where it stopped and what comes next
 */

/**
 * @typedef {object} SavedSession
 * @property {string} id the Claude Code session id, the one `claude --resume` takes
 * @property {string} cwd where the session ran
 * @property {string | null} root the project on the rails it worked on, null for a session off the rails
 * @property {"desktop" | "cli"} surface the Code tab of the desktop app, or a terminal
 * @property {string | null} localId the desktop app's id of the session, `local_…`, which changes with the sign-in
 * @property {string} title the title the app showed
 * @property {string | null} parent the old local id of the session it was started from
 * @property {Record<string, any> | null} spawnedFrom the app's link to that parent, as it was
 * @property {import("./artifacts.mjs").SavedArtifact[]} artifacts local copies of what it published
 * @property {string} transcript the transcript, relative to the config folder
 * @property {string} lastActivityAt
 * @property {SavedChange | null} change the open change of its lane
 * @property {string} branch
 * @property {string[]} uncommitted the files git reports as changed or new
 * @property {{ kind: "agent" | "bash", description: string }[]} unfinished background tasks that had not reported back
 */

/**
 * @typedef {object} Checkpoint
 * @property {1 | 2} version
 * @property {string} savedAt
 * @property {string} configDir the config folder the transcripts live in
 * @property {string | null} [desktopDir] the desktop app's folder of the account the sessions were saved from
 * @property {SavedSession[]} sessions
 * @property {{ id: string, title: string, reason: string }[]} [skipped] open sessions that could not be kept
 */

/**
 * @typedef {object} Reopened
 * @property {SavedSession} session
 * @property {string | null} newId the local id under the new sign-in, `local_<id>`, null for a terminal session
 * @property {boolean} opened whether the app has the session under the new sign-in already
 * @property {string | null} file the app's record of the reopened session
 */

/** How far back a terminal session counts as open, unless `--since` says otherwise. */
export const DEFAULT_SINCE_HOURS = 48;

/** The cwd and the entrypoint sit in the first lines; the head is never read past this. */
const HEAD_BYTES = 64 * 1024;

/** A background launch the transcript records: an async agent, or a Bash command sent to the background. */
const LAUNCHED = /^(Async agent launched|Command running in background)/;

/** Words that mark a command as one that may carry a credential. */
const SECRET_LIKE = /key|token|secret|passw|auth|credential|bearer/i;

/** How a background task reports back: a notification naming the tool call that started it. */
const REPORTED = /<tool-use-id>([^<]+)<\/tool-use-id>/g;

/**
 * The config folder Claude Code reads now: `CLAUDE_CONFIG_DIR`, or `~/.claude`.
 *
 * @returns {string}
 * @example
 * configDir(); // "/Users/ann/.claude"
 */
export function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

/**
 * The folder the checkpoints live in: `~/.claude/moku-checkpoints`, beside moku's own state.
 *
 * @returns {string}
 */
export function checkpointsDir() {
  return join(dirname(mokuHome()), "moku-checkpoints");
}

/**
 * The open sessions of the config folder, newest first. With the desktop app's folder of the current account, every
 * Code tab session there that is not archived counts, at any age and on the rails or not; Code tab transcripts of
 * other accounts or archived ones are left out. Terminal sessions count when they were active since the cut-off in
 * a directory on the rails, outside a temporary folder unless `includeTemp` asks for them or they ran in `here`.
 * Sessions whose folder or transcript is gone are listed as skipped. With `artifactsDir`, each session's artifacts
 * are copied to `<artifactsDir>/<session id>`.
 *
 * @param {{ config: string, sinceMs: number, now?: number, includeTemp?: boolean, here?: string, desktopDir?: string, artifactsDir?: string }} options
 * @returns {{ sessions: SavedSession[], skipped: { id: string, title: string, reason: string }[] }}
 * @example
 * collectSessions({ config: "/Users/ann/.claude", sinceMs: 24 * 3600e3, desktopDir }).sessions.map((session) => session.id);
 */
export function collectSessions({ config, sinceMs, now = Date.now(), includeTemp = false, here, desktopDir, artifactsDir }) {
  const projects = join(config, "projects");
  if (!existsSync(projects)) return { sessions: [], skipped: [] };

  const byId = new Map(transcripts(projects).map((file) => [basename(file, ".jsonl"), file]));
  const sessions = [];
  const skipped = [];

  // The app's own list of the current account: every session not archived
  for (const record of desktopDir ? readRecords(desktopDir).filter((entry) => !entry.archived) : []) {
    const transcript = byId.get(record.cliSessionId);
    const head = transcript ? readHead(transcript) : {};
    const cwd = head.cwd ?? record.cwd;
    if (!transcript) skipped.push({ id: record.cliSessionId, title: record.title, reason: `its transcript is not in ${config}` });
    else if (!cwd || !existsSync(cwd)) skipped.push({ id: record.cliSessionId, title: record.title, reason: `its folder ${cwd || "(none)"} is gone` });
    else sessions.push(savedSession({ config, transcript, cwd, surface: "desktop", record, artifactsDir }));
  }

  // Terminal sessions, which the app does not list: recent ones on the rails
  const listed = new Set(sessions.map((session) => session.id));
  for (const [id, transcript] of byId) {
    if (listed.has(id) || now - statSync(transcript).mtimeMs > sinceMs) continue;

    const head = readHead(transcript);
    if (!head.cwd || !existsSync(head.cwd)) continue;
    if (desktopDir && head.entrypoint === "claude-desktop") continue;
    if (!includeTemp && isTemporary(head.cwd) && !(here && isInside(head.cwd, here))) continue;
    if (!rootForSession({ cwd: head.cwd, session_id: id })) continue;

    sessions.push(savedSession({ config, transcript, cwd: head.cwd, surface: head.entrypoint === "claude-desktop" ? "desktop" : "cli", artifactsDir }));
  }

  return { sessions: sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)), skipped };
}

/**
 * Where a session stands, for the checkpoint: its rails, its tree, its unfinished tasks and copies of its artifacts.
 *
 * @param {{ config: string, transcript: string, cwd: string, surface: "desktop" | "cli", record?: import("./desktop.mjs").DesktopRecord, artifactsDir?: string }} options
 * @returns {SavedSession}
 */
function savedSession({ config, transcript, cwd, surface, record, artifactsDir }) {
  const id = basename(transcript, ".jsonl");
  const root = rootForSession({ cwd, session_id: id }) ?? null;
  const { entries, reported } = toolEntries(transcript);

  return {
    id,
    cwd,
    root,
    surface,
    localId: record?.localId ?? null,
    title: record?.title ?? "",
    parent: typeof record?.spawnedFrom?.sessionId === "string" ? record.spawnedFrom.sessionId : null,
    spawnedFrom: record?.spawnedFrom ?? null,
    transcript: relative(config, transcript),
    lastActivityAt: new Date(statSync(transcript).mtimeMs).toISOString(),
    change: root ? openChange(root) : null,
    ...gitState(cwd),
    unfinished: unfinishedTasks(entries, reported),
    artifacts: artifactsDir ? saveArtifacts(entries, cwd, join(artifactsDir, id)) : [],
  };
}

/**
 * The folder beside a checkpoint file that holds its artifacts and backups: `<checkpoints>/<time>`.
 *
 * @param {string} savedAt
 * @returns {string}
 */
export function checkpointFolder(savedAt) {
  return join(checkpointsDir(), stamp(savedAt));
}

/**
 * Where each saved session stands under the new sign-in: the local id the app gives it (`local_<id>`) and whether
 * the app has opened it already.
 *
 * @param {Checkpoint} checkpoint
 * @param {string} [root] the desktop root
 * @returns {Reopened[]}
 */
export function reopenedSessions(checkpoint, root = desktopRoot()) {
  return checkpoint.sessions.map((session) => {
    if (session.surface !== "desktop") return { session, newId: null, opened: false, file: null };

    const record = reopenedRecord(root, session.id, checkpoint.desktopDir ?? undefined);
    return { session, newId: `local_${session.id}`, opened: Boolean(record), file: record?.file ?? null };
  });
}

/**
 * Old local id → new local id, for every saved Code tab session.
 *
 * @param {Reopened[]} reopened
 * @returns {Map<string, string>}
 */
export function idMap(reopened) {
  return new Map(reopened.filter((entry) => entry.session.localId && entry.newId).map((entry) => [/** @type {string} */ (entry.session.localId), /** @type {string} */ (entry.newId)]));
}

/**
 * The message each reopened session gets: its new id, the new ids of the sessions it started (to fix in its notes
 * and HANDOFF), and where the copies of its artifacts are. Sessions with nothing of that get none.
 *
 * @param {Reopened[]} reopened
 * @returns {{ to: string, title: string, text: string }[]}
 */
export function resumeMessages(reopened) {
  const map = idMap(reopened);
  const messages = [];

  for (const { session, newId } of reopened) {
    if (!newId) continue;
    const children = reopened.filter((entry) => entry.session.parent && entry.session.parent === session.localId && entry.newId);
    const artifacts = session.artifacts ?? [];
    if (children.length === 0 && artifacts.length === 0) continue;

    const lines = [`The sessions moved to a new sign-in: every session has a new id. Yours: ${newId} (was ${session.localId}).`];
    if (children.length > 0) {
      lines.push("The sessions you started, old id → new id. Replace the old ids wherever you wrote them (notes, HANDOFF, memory) and message them by the new one:");
      for (const child of children) lines.push(`- ${child.session.title || child.session.id}: ${child.session.localId} → ${child.newId}`);
    }
    if (artifacts.length > 0) {
      lines.push("Your artifacts, with local copies saved before the sign-in (the links may not open under the new account):");
      for (const artifact of artifacts) lines.push(`- ${artifact.title || artifact.url}: ${artifact.url} → ${artifactWhere(artifact)}`);
    }
    if (session.parent && !map.has(session.parent)) lines.push(`The session that started you (${session.parent}) was not in the checkpoint.`);

    messages.push({ to: newId, title: session.title, text: lines.join("\n") });
  }

  return messages;
}

/**
 * Where an artifact's copies are, for a person: the folder, or that only the link is kept.
 *
 * @param {import("./artifacts.mjs").SavedArtifact} artifact
 * @returns {string}
 */
export function artifactWhere(artifact) {
  const kept = artifact.files.filter((file) => file.copy);
  if (kept.length === 0) return "link only (the source is gone and the session never wrote it whole)";

  const rebuilt = kept.some((file) => file.status !== "copied") ? ", rebuilt from the transcript" : "";
  const partial = kept.some((file) => file.status === "partial") ? ", an edit did not apply" : "";
  return `${artifact.dir}${rebuilt}${partial}`;
}

/**
 * Write a checkpoint as a new file named by its time, so earlier ones stay.
 *
 * @param {Checkpoint} checkpoint
 * @returns {string} the file written
 */
export function writeCheckpoint(checkpoint) {
  const file = join(checkpointsDir(), `${stamp(checkpoint.savedAt)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);

  return file;
}

/**
 * The newest checkpoint file, or undefined when there is none.
 *
 * @returns {string | undefined}
 */
export function latestCheckpoint() {
  if (!existsSync(checkpointsDir())) return undefined;

  const newest = readdirSync(checkpointsDir()).filter((name) => name.endsWith(".json")).sort().at(-1);
  return newest ? join(checkpointsDir(), newest) : undefined;
}

/**
 * A checkpoint from disk, or undefined when it is missing or cannot be read.
 *
 * @param {string} file
 * @returns {Checkpoint | undefined}
 */
export function readCheckpoint(file) {
  try {
    const checkpoint = JSON.parse(readFileSync(file, "utf8"));
    if (!(checkpoint?.version === 1 || checkpoint?.version === 2) || !Array.isArray(checkpoint.sessions)) return undefined;

    // A version 1 checkpoint knows no titles, parents or artifacts
    checkpoint.sessions = checkpoint.sessions.map((session) => ({ localId: null, title: "", parent: null, spawnedFrom: null, artifacts: [], ...session }));
    return checkpoint;
  } catch {
    return undefined;
  }
}

/**
 * The command that continues a saved session: in the desktop app for a Code tab session, in a terminal
 * otherwise, unless the person picked one surface for all.
 *
 * @param {SavedSession} session
 * @param {"desktop" | "cli" | undefined} surface
 * @returns {string}
 * @example
 * resumeCommand({ id: "4f1c…", cwd: "/work/site", surface: "cli" }); // "cd '/work/site' && claude --resume 4f1c…"
 */
export function resumeCommand(session, surface) {
  const desktop = (surface ?? session.surface) === "desktop";

  return `cd ${quote(session.cwd)} && claude${desktop ? " --desktop" : ""} --resume ${session.id}`;
}

/**
 * What changed for a saved session since the checkpoint: a transcript the current config folder cannot see,
 * a directory that left the rails, a station that moved on, a tree that changed.
 *
 * @param {SavedSession} session
 * @param {string} config the config folder Claude Code reads now
 * @returns {string[]} one note per difference, empty when the session is as it was saved
 */
export function driftNotes(session, config) {
  const notes = [];
  if (!existsSync(join(config, session.transcript))) notes.push(`its transcript is not in ${config}; continue it from the config folder it was saved in`);

  // The rails and the tree, read again now
  const root = rootForSession({ cwd: session.cwd, session_id: session.id });
  if (!root && session.root) return [...notes, "the directory is no longer on the rails"];

  const change = root ? openChange(root) : null;
  if (session.change && change?.id !== session.change.id) notes.push(`change ${session.change.id} is no longer open here`);
  else if (session.change && change && change.station !== session.change.station) notes.push(`the station moved from ${session.change.station ?? "between stations"} to ${change.station ?? "between stations"}`);

  const now = gitState(session.cwd).uncommitted.length;
  if (now !== session.uncommitted.length) notes.push(`uncommitted files: ${session.uncommitted.length} at save, ${now} now`);

  return notes;
}

/**
 * One line that describes a saved session for a person.
 *
 * @param {SavedSession} session
 * @returns {string}
 */
export function describeSession(session) {
  const tree = [session.branch, `${session.uncommitted.length} uncommitted`].filter(Boolean).join(", ");

  const title = session.title ? `"${session.title}" ` : "";

  return `${title}${session.id.slice(0, 8)} ${session.surface} · ${session.cwd} · ${tree}`;
}

/**
 * The top-level transcripts of a projects folder. Subagent transcripts sit one level deeper and are no
 * session of their own.
 *
 * @param {string} projects
 * @returns {string[]}
 */
function transcripts(projects) {
  return readdirSync(projects, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(projects, entry.name), { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
      .map((file) => join(projects, entry.name, file.name)));
}

/**
 * The cwd and the entrypoint from the first lines of a transcript.
 *
 * @param {string} transcript
 * @returns {{ cwd?: string, entrypoint?: string }}
 */
function readHead(transcript) {
  const buffer = Buffer.alloc(HEAD_BYTES);
  let length = 0;
  try {
    const handle = openSync(transcript, "r");
    length = readSync(handle, buffer, 0, HEAD_BYTES, 0);
    closeSync(handle);
  } catch {
    return {};
  }

  // A line cut by the byte limit does not parse and is skipped
  for (const line of buffer.subarray(0, length).toString("utf8").split("\n")) {
    const entry = parseLine(line);
    if (typeof entry?.cwd === "string") return { cwd: entry.cwd, entrypoint: typeof entry.entrypoint === "string" ? entry.entrypoint : undefined };
  }

  return {};
}

/**
 * The lines of a transcript that hold a tool call or its result, parsed, in order, and the tool calls whose
 * background task reported back. Lines of the conversation without a tool call are never parsed.
 *
 * @param {string} transcript
 * @returns {{ entries: Record<string, any>[], reported: Set<string> }}
 */
function toolEntries(transcript) {
  const entries = [];
  const reported = new Set();
  let text = "";
  try {
    text = readFileSync(transcript, "utf8");
  } catch {
    return { entries, reported };
  }

  for (const line of text.split("\n")) {
    for (const match of line.matchAll(REPORTED)) reported.add(match[1]);
    if (!line.includes("tool_use")) continue;

    const entry = parseLine(line);
    if (entry) entries.push(entry);
  }

  return { entries, reported };
}

/**
 * The background tasks a session started that never reported back. They do not survive the session, so the
 * person restarts them after the resume.
 *
 * @param {Record<string, any>[]} entries the transcript's tool lines
 * @param {Set<string>} reported the tool calls whose task reported back
 * @returns {SavedSession["unfinished"]}
 */
function unfinishedTasks(entries, reported) {
  /** @type {Map<string, { kind: "agent" | "bash", description: string }>} */
  const calls = new Map();
  const launched = new Set();

  for (const entry of entries) {
    for (const block of contentBlocks(entry)) {
      if (block.type === "tool_use" && (block.name === "Agent" || block.name === "Task" || block.input?.run_in_background === true)) {
        calls.set(block.id, { kind: block.name === "Bash" ? "bash" : "agent", description: taskLabel(block) });
      }
      if (block.type === "tool_result" && LAUNCHED.test(resultText(block))) launched.add(block.tool_use_id);
    }
  }

  return [...launched].filter((id) => !reported.has(id) && calls.has(id)).map((id) => /** @type {{ kind: "agent" | "bash", description: string }} */ (calls.get(id)));
}

/**
 * What a background task did, for the person who restarts it: its description, or the start of its command.
 * A command that looks like it carries a credential is never repeated.
 *
 * @param {Record<string, any>} block a tool_use block
 * @returns {string}
 */
function taskLabel(block) {
  if (typeof block.input?.description === "string" && block.input.description) return block.input.description;

  const command = String(block.input?.command ?? "").replace(/\s+/g, " ").trim();
  if (!command || SECRET_LIKE.test(command)) return `a background ${block.name}`;
  return command.length > 80 ? `${command.slice(0, 77)}...` : command;
}

/**
 * @param {Record<string, any> | undefined} entry
 * @returns {Record<string, any>[]}
 */
function contentBlocks(entry) {
  const content = entry?.message?.content;
  return Array.isArray(content) ? content : [];
}

/**
 * @param {Record<string, any>} block
 * @returns {string}
 */
function resultText(block) {
  if (typeof block.content === "string") return block.content;
  return Array.isArray(block.content) ? String(block.content.find((part) => part?.type === "text")?.text ?? "") : "";
}

/**
 * @param {string} line
 * @returns {Record<string, any> | undefined}
 */
function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

/**
 * The open change of the lane the root belongs to, with a short line on where it stopped.
 *
 * @param {string} root
 * @returns {SavedChange | null}
 */
function openChange(root) {
  try {
    const change = loadLedger(root).changes.find((entry) => entry.status === "open");
    return change ? { id: change.id, title: change.title ?? "", size: change.size, station: change.station ?? null, next: nextStep(change) } : null;
  } catch {
    return null;
  }
}

/**
 * Where a change stopped and what comes next, from its route.
 *
 * @param {Record<string, any>} change
 * @returns {string}
 * @example
 * nextStep({ size: "S", station: null, done: ["intake", "build"] }); // "next: verify"
 */
function nextStep(change) {
  const pause = change.paused && change.pauseReason ? `, paused: ${change.pauseReason}` : "";
  if (change.station) return `inside ${change.station}${pause}`;

  const next = routeFor(change.size).find((station) => !change.done.includes(station));
  return `${next ? `next: ${next}` : "ready to close"}${pause}`;
}

/**
 * The branch and the changed or new files, from `git status`. Outside git both are empty.
 *
 * @param {string} cwd
 * @returns {{ branch: string, uncommitted: string[] }}
 */
function gitState(cwd) {
  const run = spawnSync("git", ["-C", cwd, "status", "--porcelain=v1", "--branch", "--untracked-files=all"], { encoding: "utf8" });
  if (run.status !== 0) return { branch: "", uncommitted: [] };

  const [header = "", ...files] = run.stdout.split("\n").filter(Boolean);
  return {
    branch: header.replace(/^## /, "").split("...")[0].replace(/^No commits yet on /, ""),
    uncommitted: files.map((line) => line.slice(3)),
  };
}

/**
 * Whether a folder sits in the system's temporary space, where eval runs and scratch projects live.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isTemporary(path) {
  return [tmpdir(), realpathSync(tmpdir()), "/tmp", "/private/tmp"].some((dir) => isInside(path, dir));
}

/**
 * @param {string} path
 * @param {string} dir
 * @returns {boolean}
 */
function isInside(path, dir) {
  return path === dir || path.startsWith(`${dir}${sep}`);
}

/**
 * A checkpoint time as a file name: `2026-11-06T05-40-40Z`.
 *
 * @param {string} savedAt
 * @returns {string}
 */
function stamp(savedAt) {
  return savedAt.replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
}

/**
 * @param {string} path
 * @returns {string}
 */
function quote(path) {
  return `'${path.replace(/'/g, "'\\''")}'`;
}
