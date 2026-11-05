/**
 * Checkpoint: keep the progress of every open moku session on this machine, so each one continues after the
 * person signs in again, in any way (an API key, a Team account, another sign-in).
 *
 * One concern: on request, write a checkpoint of the sessions that worked on the rails lately, and turn it back
 * into the commands that continue each one. The sign-in itself is the person's, through `claude auth login`: no
 * token, no Keychain, no credentials file is read or written here.
 *
 * What a session is comes from its transcript: the file name is its id, the first lines name its cwd and where it
 * runs, and its tool calls say which background tasks it started and which of them reported back. Only the
 * description of an unfinished task is kept; nothing of the conversation is copied.
 */

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

import { mokuHome, rootForSession } from "../hooks/root.mjs";
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
 * @property {string} root the project on the rails it worked on
 * @property {"desktop" | "cli"} surface the Code tab of the desktop app, or a terminal
 * @property {string} transcript the transcript, relative to the config folder
 * @property {string} lastActivityAt
 * @property {SavedChange | null} change the open change of its lane
 * @property {string} branch
 * @property {string[]} uncommitted the files git reports as changed or new
 * @property {{ kind: "agent" | "bash", description: string }[]} unfinished background tasks that had not reported back
 */

/**
 * @typedef {object} Checkpoint
 * @property {1} version
 * @property {string} savedAt
 * @property {string} configDir the config folder the transcripts live in
 * @property {SavedSession[]} sessions
 */

/** How far back a session counts as open, unless `--since` says otherwise. */
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
 * Every session of the config folder active since the cut-off whose directory is on the rails, newest first.
 * Sessions that ran in a temporary folder (eval runs, scratch projects) are left out unless `includeTemp` asks
 * for them or they ran in `here`, the project the command runs in; sessions whose folder is gone are left out too.
 *
 * @param {{ config: string, sinceMs: number, now?: number, includeTemp?: boolean, here?: string }} options
 * @returns {SavedSession[]}
 * @example
 * collectSessions({ config: "/Users/ann/.claude", sinceMs: 24 * 3600e3 }).map((session) => session.id);
 */
export function collectSessions({ config, sinceMs, now = Date.now(), includeTemp = false, here }) {
  const projects = join(config, "projects");
  if (!existsSync(projects)) return [];

  const sessions = [];
  for (const transcript of transcripts(projects)) {
    const modified = statSync(transcript).mtimeMs;
    if (now - modified > sinceMs) continue;

    const head = readHead(transcript);
    const id = transcript.split("/").at(-1)?.replace(/\.jsonl$/, "") ?? "";
    if (!head.cwd || !existsSync(head.cwd)) continue;
    if (!includeTemp && isTemporary(head.cwd) && !(here && isInside(head.cwd, here))) continue;

    const root = rootForSession({ cwd: head.cwd, session_id: id });
    if (!root) continue;

    sessions.push({
      id,
      cwd: head.cwd,
      root,
      surface: head.entrypoint === "claude-desktop" ? "desktop" : "cli",
      transcript: relative(config, transcript),
      lastActivityAt: new Date(modified).toISOString(),
      change: openChange(root),
      ...gitState(head.cwd),
      unfinished: unfinishedTasks(transcript),
    });
  }

  return sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/**
 * Write a checkpoint as a new file named by its time, so earlier ones stay.
 *
 * @param {Checkpoint} checkpoint
 * @returns {string} the file written
 */
export function writeCheckpoint(checkpoint) {
  const file = join(checkpointsDir(), `${checkpoint.savedAt.replace(/:/g, "-").replace(/\.\d+Z$/, "Z")}.json`);
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
    return checkpoint?.version === 1 && Array.isArray(checkpoint.sessions) ? checkpoint : undefined;
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
  if (!root) return [...notes, "the directory is no longer on the rails"];

  const change = openChange(root);
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

  return `${session.id.slice(0, 8)} ${session.surface} · ${session.cwd} · ${tree}`;
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
 * The background tasks a session started that never reported back. They do not survive the session, so the
 * person restarts them after the resume.
 *
 * @param {string} transcript
 * @returns {SavedSession["unfinished"]}
 */
function unfinishedTasks(transcript) {
  /** @type {Map<string, { kind: "agent" | "bash", description: string }>} */
  const calls = new Map();
  const launched = new Set();
  const reported = new Set();

  let text = "";
  try {
    text = readFileSync(transcript, "utf8");
  } catch {
    return [];
  }

  // Only lines that can hold a launch, its result or a report are parsed
  for (const line of text.split("\n")) {
    if (!line.includes("tool_use") && !line.includes("<tool-use-id>")) continue;
    for (const match of line.matchAll(REPORTED)) reported.add(match[1]);

    for (const block of contentBlocks(parseLine(line))) {
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
 * @param {string} path
 * @returns {string}
 */
function quote(path) {
  return `'${path.replace(/'/g, "'\\''")}'`;
}
