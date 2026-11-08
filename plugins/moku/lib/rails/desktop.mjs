/**
 * Desktop index: what the Claude desktop app knows about its Code tab sessions, read from its own records.
 *
 * One concern: read the app's per-account session records (title, archived, the parent a side session was started
 * from), tell which sessions were opened again under a new sign-in, and, only on the person's explicit request with
 * the app closed, write the parent and the title back into the new records. The records are not a documented
 * interface: they are read as data, and written only by `relinkSessions`, after a backup, two fields at a time.
 *
 * Layout: `<desktop root>/<account uuid>/<org uuid>/local_<id>.json`, one record per session. A session opened
 * again under another account gets a new record whose id is `local_<cliSessionId>`, the Claude Code session id.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * @typedef {object} DesktopRecord
 * @property {string} localId the app's id of the session, `local_…`
 * @property {string} cliSessionId the Claude Code session id, the one `claude --resume` takes
 * @property {string} title
 * @property {boolean} archived
 * @property {string} cwd
 * @property {number} lastActivityAt
 * @property {Record<string, any> | null} spawnedFrom the side-session link to the parent, as the app wrote it
 * @property {string} branch the branch the app had the session on, empty when it named none
 * @property {string | null} worktreePath the worktree the app made for the session, null when it made none
 * @property {string} originCwd the folder the session was started from, the repository of its worktree
 * @property {string | null} permissionMode the permission mode the session runs in, such as `auto`
 * @property {string} file
 */

/**
 * The folder the desktop app keeps its Code tab sessions in: `MOKU_DESKTOP_SESSIONS`, or the app's own folder.
 *
 * @returns {string}
 * @example
 * desktopRoot(); // "/Users/ann/Library/Application Support/Claude/claude-code-sessions"
 */
export function desktopRoot() {
  return process.env.MOKU_DESKTOP_SESSIONS || join(homedir(), "Library", "Application Support", "Claude", "claude-code-sessions");
}

/**
 * Every session record of one account and organization, archived ones included.
 *
 * @param {string} dir `<desktop root>/<account>/<org>`
 * @returns {DesktopRecord[]}
 */
export function readRecords(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.startsWith("local_") && name.endsWith(".json"))
    .map((name) => toRecord(join(dir, name)))
    .filter((record) => record !== undefined);
}

/**
 * The account folder the sessions of this sign-in live in: the account and organization the running session names,
 * else the folder holding the most recently active record. Undefined when the app keeps no sessions here.
 *
 * @param {string} root the desktop root
 * @param {{ account?: string, org?: string }} [named] an account and organization to use instead
 * @returns {string | undefined}
 * @example
 * currentAccountDir(desktopRoot()); // ".../claude-code-sessions/17f53315-…/bd8c1451-…"
 */
export function currentAccountDir(root, named = {}) {
  const account = named.account ?? process.env.CLAUDE_CODE_ACCOUNT_UUID;
  const org = named.org ?? process.env.CLAUDE_CODE_ORGANIZATION_UUID;
  if (account && org && existsSync(join(root, account, org))) return join(root, account, org);

  let newest;
  for (const dir of accountDirs(root)) {
    for (const record of readRecords(dir)) {
      if (!newest || record.lastActivityAt > newest.at) newest = { dir, at: record.lastActivityAt };
    }
  }

  return newest?.dir;
}

/**
 * The record of a session opened again under another account: `local_<cliSessionId>.json` in any account folder
 * but the one it was saved from, the newest when there are several.
 *
 * @param {string} root the desktop root
 * @param {string} cliSessionId
 * @param {string | undefined} savedFrom the account folder of the checkpoint, never the answer
 * @returns {DesktopRecord | undefined}
 */
export function reopenedRecord(root, cliSessionId, savedFrom) {
  const candidates = accountDirs(root)
    .filter((dir) => dir !== savedFrom)
    .map((dir) => join(dir, `local_${cliSessionId}.json`))
    .filter((file) => existsSync(file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  return candidates.length > 0 ? toRecord(candidates[0]) : undefined;
}

/**
 * Whether the desktop app is running. Its records must not be written while it runs: it keeps them in memory and
 * writes them back on its own.
 *
 * @returns {boolean}
 */
export function desktopAppRunning() {
  if (process.env.MOKU_DESKTOP_RUNNING !== undefined) return process.env.MOKU_DESKTOP_RUNNING === "1";

  const run = spawnSync("ps", ["-axo", "comm="], { encoding: "utf8" });
  return run.status === 0 && run.stdout.split("\n").some((line) => /\/Claude\.app\/Contents\/MacOS\/Claude$/.test(line.trim()));
}

/** The pause between two sessions opened in the app, so each gets its record before the next one starts. */
const OPEN_PAUSE_MS = Number(process.env.MOKU_OPEN_PAUSE_MS ?? 3000);

/** The permission modes `claude --permission-mode` takes; `default` is the mode a session gets without the flag. */
export const CLI_PERMISSION_MODES = new Set(["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"]);

/**
 * Open one session in the desktop app under the current sign-in, in the permission mode it had. `claude --desktop
 * --resume` hands the session to the app only from a terminal, so it runs under `script`, which gives it one; then a
 * pause.
 *
 * @param {string} cwd
 * @param {string} cliSessionId
 * @param {string | null} [permissionMode] the mode the session had, passed on when the CLI knows it
 * @returns {boolean} whether the command succeeded
 */
export function openInDesktop(cwd, cliSessionId, permissionMode = null) {
  const mode = permissionMode && CLI_PERMISSION_MODES.has(permissionMode) ? ["--permission-mode", permissionMode] : [];
  const run = spawnSync("script", ["-q", "/dev/null", "claude", "--desktop", "--resume", cliSessionId, ...mode], { cwd, stdio: ["ignore", "ignore", "ignore"], timeout: 60_000 });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, OPEN_PAUSE_MS);

  return run.status === 0;
}

/**
 * Write the parent link, the title and the permission mode back into the records of sessions opened again, after
 * copying each record into the backup folder. A parent is set only when the parent was opened again too; nesting of any depth follows,
 * since each session points at its own parent.
 *
 * @param {{ localId: string, cliSessionId: string, title: string, parent: string | null, spawnedFrom: Record<string, any> | null, permissionMode?: string | null, file: string }[]} sessions
 *   each saved session with `file`, the record it has now
 * @param {Map<string, string>} idMap old local id → new local id
 * @param {string} backupDir
 * @returns {{ linked: string[], titled: string[], moded: string[] }} the new ids whose parent, title or mode was written
 */
export function relinkSessions(sessions, idMap, backupDir) {
  mkdirSync(backupDir, { recursive: true });
  const linked = [];
  const titled = [];
  const moded = [];

  for (const session of sessions) {
    const record = JSON.parse(readFileSync(session.file, "utf8"));
    const parentNow = session.parent ? idMap.get(session.parent) : undefined;
    const wantsParent = Boolean(parentNow && session.spawnedFrom && record.spawnedFrom?.sessionId !== parentNow);
    const wantsTitle = Boolean(session.title && record.title !== session.title);
    const wantsMode = Boolean(session.permissionMode && record.permissionMode !== session.permissionMode);
    if (!wantsParent && !wantsTitle && !wantsMode) continue;

    copyFileSync(session.file, join(backupDir, basename(session.file)));
    if (wantsParent) {
      record.spawnedFrom = { ...session.spawnedFrom, sessionId: parentNow };
      linked.push(record.sessionId);
    }
    if (wantsTitle) {
      record.title = session.title;
      titled.push(record.sessionId);
    }
    if (wantsMode) {
      record.permissionMode = session.permissionMode;
      moded.push(record.sessionId);
    }

    // Written whole and read back, so a record that does not parse is never left behind
    const text = JSON.stringify(record);
    JSON.parse(text);
    writeFileSync(session.file, text);
  }

  return { linked, titled, moded };
}

/**
 * The `<account>/<org>` folders of the desktop root.
 *
 * @param {string} root
 * @returns {string[]}
 */
function accountDirs(root) {
  if (!existsSync(root)) return [];

  return subdirs(root).flatMap((account) => subdirs(account));
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function subdirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name));
}

/**
 * A record from disk, or undefined when it does not parse or names no Claude Code session.
 *
 * @param {string} file
 * @returns {DesktopRecord | undefined}
 */
function toRecord(file) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (typeof data.cliSessionId !== "string" || !data.cliSessionId) return undefined;

    return {
      localId: typeof data.sessionId === "string" ? data.sessionId : basename(file, ".json"),
      cliSessionId: data.cliSessionId,
      title: typeof data.title === "string" ? data.title : "",
      archived: data.isArchived === true,
      cwd: typeof data.cwd === "string" ? data.cwd : "",
      lastActivityAt: Number(data.lastActivityAt) || 0,
      spawnedFrom: data.spawnedFrom && typeof data.spawnedFrom === "object" ? data.spawnedFrom : null,
      branch: typeof data.branch === "string" ? data.branch : "",
      worktreePath: typeof data.worktreePath === "string" && data.worktreePath ? data.worktreePath : null,
      originCwd: typeof data.originCwd === "string" ? data.originCwd : "",
      permissionMode: typeof data.permissionMode === "string" && data.permissionMode ? data.permissionMode : null,
      file,
    };
  } catch {
    return undefined;
  }
}
