/**
 * Checkpoint: a snapshot of the sessions the desktop app's sidebar shows, taken only when the person asks for it.
 *
 * One concern: write and read the snapshot. It holds exactly the sessions of the current account that are not
 * archived (what `list_sessions` lists, plus the session that saves), each with the fields of its record that say
 * where it sits and what it works in: its parent as the sidebar nests it, title, permission mode, folder, worktree and
 * branch, and which session leases each worktree. Nothing of a conversation is copied, and no credential is read.
 * Records of other accounts never count: a machine that held four sign-ins has old records of the same sessions in
 * each (on 2026-11-11 five sessions were taken from such a folder).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { mokuHome } from "../hooks/root.mjs";
import { desktopRoot, readAccount, readWorktrees, worktreesFile } from "./desktop.mjs";

/** The record fields a restore writes back: where the session sits, what it is called and what it works in. */
export const SAVED_FIELDS = [
  "title",
  "titleSource",
  "permissionMode",
  "cwd",
  "originCwd",
  "branch",
  "sourceBranch",
  "worktreePath",
  "worktreeName",
  "gitAnchors",
  "gitAnchorsLookupOnly",
  "folderPlace",
  "spawnedFrom",
  "startChain",
  "spawnSeed",
  "lineageDetached",
  "lineageDetachedBy",
];

/**
 * @typedef {object} SavedSession
 * @property {string} localId the app's id when it was saved, `local_…`
 * @property {string} cli the Claude Code session id
 * @property {string} title
 * @property {string | null} parent the local id of the saved session it is nested under in the sidebar, or null
 * @property {string} cwd
 * @property {string | null} worktree the name of the app's worktree it works in
 * @property {string} branch
 * @property {string} mode its permission mode
 * @property {boolean} transcript whether its transcript is on this machine, the only way it can be opened again
 * @property {Record<string, any>} record the saved record fields, `SAVED_FIELDS`
 */

/**
 * @typedef {object} Checkpoint
 * @property {3} version
 * @property {string} savedAt
 * @property {string} account `<account>/<org>` it was saved from
 * @property {string | null} self the cli id of the session that saved it
 * @property {SavedSession[]} sessions parents before the sessions nested under them
 * @property {Record<string, string>} leases worktree name → local id of the saved session that held it
 * @property {string} [transcriptsUnread] the transcripts folder, when it could not be read at the save
 */

/**
 * The folder the checkpoints live in: `~/.claude/moku-checkpoints`, beside moku's own state.
 *
 * @returns {string}
 */
export function checkpointsDir() {
  return join(dirname(mokuHome()), "moku-checkpoints");
}

/**
 * The folder transcripts live in: `MOKU_TRANSCRIPTS`, or `<config>/projects`.
 *
 * @returns {string}
 */
export function transcriptsDir() {
  return process.env.MOKU_TRANSCRIPTS || join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
}

/**
 * The snapshot of the sidebar of one account: every session not archived, minus the ones named in `drop`.
 *
 * @param {{ key: string, root?: string, registry?: string, self?: string | null, drop?: string[], now?: Date }} options
 * @returns {Checkpoint}
 */
export function takeSnapshot({ key, root = desktopRoot(), registry = worktreesFile(root), self = null, drop = [], now = new Date() }) {
  const open = readAccount(key, root).records.filter((record) => !record.archived && !drop.includes(record.localId) && !drop.includes(record.cli));
  const ids = new Set(open.map((record) => record.localId));
  // A sandbox may refuse the transcripts folder: then nobody knows, and the session is kept as one that can open
  const transcripts = transcriptIds();
  const worktrees = readWorktrees(registry);

  const sessions = open.map(({ data, localId, cli }) => {
    const parentId = typeof data.spawnedFrom?.sessionId === "string" ? data.spawnedFrom.sessionId : null;
    const record = Object.fromEntries(SAVED_FIELDS.filter((field) => data[field] !== undefined).map((field) => [field, data[field]]));
    return {
      localId,
      cli,
      title: typeof data.title === "string" ? data.title : "",
      parent: parentId && ids.has(parentId) && data.lineageDetached !== true ? parentId : null,
      cwd: typeof data.cwd === "string" ? data.cwd : "",
      worktree: typeof data.worktreeName === "string" && data.worktreeName ? data.worktreeName : null,
      branch: typeof data.branch === "string" ? data.branch : "",
      mode: typeof data.permissionMode === "string" ? data.permissionMode : "default",
      transcript: transcripts ? transcripts.has(cli) : true,
      record,
    };
  });

  const leases = {};
  for (const name of new Set(sessions.map((session) => session.worktree).filter(Boolean))) {
    const holder = worktrees[/** @type {string} */ (name)]?.leasedBy;
    if (typeof holder === "string" && ids.has(holder)) leases[/** @type {string} */ (name)] = holder;
  }

  return { version: 3, savedAt: now.toISOString(), account: key, self, sessions: treeOrder(sessions), leases, ...(transcripts ? {} : { transcriptsUnread: transcriptsDir() }) };
}

/**
 * Sessions with each parent before the sessions under it, siblings by title (by code point, the same on every
 * machine), so the file reads like the sidebar.
 *
 * @template {{ localId: string, parent: string | null, title: string }} T
 * @param {T[]} sessions
 * @returns {T[]}
 */
export function treeOrder(sessions) {
  const ids = new Set(sessions.map((session) => session.localId));
  const children = (/** @type {string | null} */ parent) => sessions.filter((session) => (session.parent && ids.has(session.parent) ? session.parent : null) === parent).sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const ordered = [];
  const visit = (/** @type {string | null} */ parent, /** @type {number} */ depth) => {
    for (const session of children(parent)) {
      if (ordered.includes(session) || depth > 32) continue;
      ordered.push(session);
      visit(session.localId, depth + 1);
    }
  };
  visit(null, 0);
  // A loop of parents has no root: it is listed at the end rather than lost
  return [...ordered, ...sessions.filter((session) => !ordered.includes(session))];
}

/**
 * The sessions as an indented tree, one line each.
 *
 * @param {{ localId: string, parent: string | null, title: string }[]} sessions in tree order
 * @param {(session: any) => string} describe the rest of each line
 * @returns {string[]}
 */
export function treeLines(sessions, describe) {
  const depth = new Map();
  return sessions.map((session) => {
    const level = session.parent && depth.has(session.parent) ? depth.get(session.parent) + 1 : 0;
    depth.set(session.localId, level);
    return `${"  ".repeat(level)}- ${describe(session)}`;
  });
}

/**
 * Write a checkpoint as a new file named by its time.
 *
 * @param {Checkpoint} checkpoint
 * @returns {string}
 */
export function writeCheckpoint(checkpoint) {
  const file = join(checkpointsDir(), `${stamp(checkpoint.savedAt)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);
  return file;
}

/**
 * The newest checkpoint of this version, or undefined. Older files of earlier versions are left where they are.
 *
 * @returns {string | undefined}
 */
export function latestCheckpoint() {
  if (!existsSync(checkpointsDir())) return undefined;
  return readdirSync(checkpointsDir())
    .filter((name) => /^\d{4}-\d\d-\d\dT[\d-]+Z\.json$/.test(name))
    .sort()
    .reverse()
    .map((name) => join(checkpointsDir(), name))
    .find((file) => readCheckpoint(file) !== undefined);
}

/**
 * A checkpoint from disk, or undefined when it is not one of this version.
 *
 * @param {string} file
 * @returns {Checkpoint | undefined}
 */
export function readCheckpoint(file) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data?.version === 3 && Array.isArray(data.sessions) ? data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The folder beside a checkpoint for its backups and its record of sent messages.
 *
 * @param {string} file
 * @returns {string}
 */
export function checkpointFolder(file) {
  return file.replace(/\.json$/, "");
}

/**
 * The cli ids of the transcripts on this machine, `<projects>/<folder>/<id>.jsonl`, or null when the folder cannot
 * be read.
 *
 * @returns {Set<string> | null}
 */
function transcriptIds() {
  const root = transcriptsDir();
  const ids = new Set();
  try {
    if (!existsSync(root)) return ids;
    for (const folder of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      for (const name of readdirSync(join(root, folder.name))) if (name.endsWith(".jsonl")) ids.add(name.slice(0, -6));
    }
    return ids;
  } catch {
    return null;
  }
}

/**
 * A time as a file name: `2026-11-18T09-37-19Z`.
 *
 * @param {string} savedAt
 * @returns {string}
 */
function stamp(savedAt) {
  return savedAt.replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
}
