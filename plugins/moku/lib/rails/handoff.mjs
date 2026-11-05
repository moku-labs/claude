/**
 * Handoff: carry the open moku sessions across a change of sign-in, such as moving from the subscription to a
 * Console API key, to a Team account, or into a config folder of its own.
 *
 * One concern: write a checkpoint of the sessions that worked on the rails lately, and turn it back into the
 * commands that continue each one. The sign-in itself is never touched: no token, no Keychain, no credentials
 * file is read or written. The person switches with Claude Code's own commands.
 *
 * What a session is comes from its transcript: the file name is its id, and the first lines name its cwd and
 * where it runs. Nothing else of the transcript is read, and nothing of it is copied.
 */

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

import { mokuHome, rootForSession } from "../hooks/root.mjs";
import { loadLedger } from "./ledger.mjs";

/**
 * @typedef {object} SavedSession
 * @property {string} id the Claude Code session id, the one `claude --resume` takes
 * @property {string} cwd where the session ran
 * @property {string} root the project on the rails it worked on
 * @property {"desktop" | "cli"} surface the Code tab of the desktop app, or a terminal
 * @property {string} transcript the transcript, relative to the config folder
 * @property {string} lastActivityAt
 * @property {{ id: string, station: string | null, size: string } | null} change the open change of its lane
 * @property {string} branch
 * @property {number} uncommitted files git reports as changed or new
 */

/**
 * @typedef {object} Checkpoint
 * @property {1} version
 * @property {string} savedAt
 * @property {string} configDir the config folder the transcripts live in
 * @property {SavedSession[]} sessions
 */

/** How far back a session counts as open, unless `--since` says otherwise. */
export const DEFAULT_SINCE_HOURS = 24;

/** The cwd and the entrypoint sit in the first lines; a transcript is never read past this. */
const HEAD_BYTES = 64 * 1024;

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
 * The checkpoint file. One per machine, beside the session bindings.
 *
 * @returns {string}
 */
export function checkpointFile() {
  return join(mokuHome(), "handoff.json");
}

/**
 * Every session of the config folder active since the cut-off whose directory is on the rails, newest first.
 *
 * Sessions that ran in a temporary folder (eval runs, scratch projects) are left out unless `includeTemp` asks
 * for them, and so are sessions whose folder is gone.
 *
 * @param {{ config: string, sinceMs: number, now?: number, includeTemp?: boolean }} options
 * @returns {SavedSession[]}
 * @example
 * collectSessions({ config: "/Users/ann/.claude", sinceMs: 24 * 3600e3 }).map((session) => session.id);
 */
export function collectSessions({ config, sinceMs, now = Date.now(), includeTemp = false }) {
  const projects = join(config, "projects");
  if (!existsSync(projects)) return [];

  const sessions = [];
  for (const transcript of transcripts(projects)) {
    const modified = statSync(transcript).mtimeMs;
    if (now - modified > sinceMs) continue;

    const head = readHead(transcript);
    const id = transcript.split("/").at(-1)?.replace(/\.jsonl$/, "") ?? "";
    if (!head.cwd || !existsSync(head.cwd) || (!includeTemp && isTemporary(head.cwd))) continue;

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
    });
  }

  return sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/**
 * Write the checkpoint, replacing an earlier one.
 *
 * @param {Checkpoint} checkpoint
 * @returns {string} the file written
 */
export function writeCheckpoint(checkpoint) {
  const file = checkpointFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);

  return file;
}

/**
 * The checkpoint on disk, or undefined when there is none or it cannot be read.
 *
 * @returns {Checkpoint | undefined}
 */
export function readCheckpoint() {
  try {
    const checkpoint = JSON.parse(readFileSync(checkpointFile(), "utf8"));
    return checkpoint?.version === 1 && Array.isArray(checkpoint.sessions) ? checkpoint : undefined;
  } catch {
    return undefined;
  }
}

/** Remove the checkpoint. Safe to repeat. */
export function clearCheckpoint() {
  rmSync(checkpointFile(), { force: true });
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
 * a directory that left the rails, a station that moved on, files committed or added meanwhile.
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

  const now = gitState(session.cwd).uncommitted;
  if (now !== session.uncommitted) notes.push(`uncommitted files: ${session.uncommitted} at save, ${now} now`);

  return notes;
}

/**
 * One line that describes a saved session for a person.
 *
 * @param {SavedSession} session
 * @returns {string}
 */
export function describeSession(session) {
  const change = session.change ? `${session.change.id} at ${session.change.station ?? "between stations"}` : "no open change";
  const tree = session.branch ? `${session.branch}, ${session.uncommitted} uncommitted` : `${session.uncommitted} uncommitted`;

  return `${session.id.slice(0, 8)} ${session.surface} · ${session.cwd} · ${change} · ${tree}`;
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
    try {
      const entry = JSON.parse(line);
      if (typeof entry.cwd === "string") return { cwd: entry.cwd, entrypoint: typeof entry.entrypoint === "string" ? entry.entrypoint : undefined };
    } catch {
      continue;
    }
  }

  return {};
}

/**
 * The open change of the lane the root belongs to.
 *
 * @param {string} root
 * @returns {SavedSession["change"]}
 */
function openChange(root) {
  try {
    const change = loadLedger(root).changes.find((entry) => entry.status === "open");
    return change ? { id: change.id, station: change.station ?? null, size: change.size } : null;
  } catch {
    return null;
  }
}

/**
 * The branch and the count of changed or new files, from `git status`. Outside git both are empty.
 *
 * @param {string} cwd
 * @returns {{ branch: string, uncommitted: number }}
 */
function gitState(cwd) {
  const run = spawnSync("git", ["-C", cwd, "status", "--porcelain=v1", "--branch"], { encoding: "utf8" });
  if (run.status !== 0) return { branch: "", uncommitted: 0 };

  const [header = "", ...files] = run.stdout.split("\n").filter(Boolean);
  return { branch: header.replace(/^## /, "").split("...")[0].replace(/^No commits yet on /, ""), uncommitted: files.length };
}

/**
 * Whether a folder sits in the system's temporary space, where eval runs and scratch projects live.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isTemporary(path) {
  const temp = [tmpdir(), realpathSync(tmpdir()), "/tmp", "/private/tmp"];
  return temp.some((dir) => path === dir || path.startsWith(`${dir}${sep}`));
}

/**
 * @param {string} path
 * @returns {string}
 */
function quote(path) {
  return `'${path.replace(/'/g, "'\\''")}'`;
}
