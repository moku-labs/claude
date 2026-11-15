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
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
 * @property {boolean} detached whether the side session was moved to the top level (`lineageDetached`)
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
  // The account the running session names is the current one, even before the app keeps a record there
  if (account && org) return join(root, account, org);

  let newest;
  for (const dir of accountDirs(root)) {
    for (const record of readRecords(dir)) {
      if (!newest || record.lastActivityAt > newest.at) newest = { dir, at: record.lastActivityAt };
    }
  }

  return newest?.dir;
}

/**
 * The record the current account keeps of a saved session: `local_<cliSessionId>.json`, or, when the sessions are
 * restored into the account they were saved from, the record under its old local id. A record in any other account
 * folder is not the current sign-in's and never counts: the machine may have held three or four sign-ins, each with
 * old records of the same sessions (on 2026-11-11 five sessions were taken as open from such a folder).
 *
 * @param {string} root the desktop root
 * @param {string} cliSessionId
 * @param {string | undefined} savedFrom the account folder of the checkpoint
 * @param {string | undefined} [current] the account folder of the current sign-in
 * @param {string | null} [oldLocalId] the local id the session had when it was saved
 * @returns {DesktopRecord | undefined}
 */
export function reopenedRecord(root, cliSessionId, savedFrom, current = currentAccountDir(root), oldLocalId = null) {
  if (!current) return undefined;
  const names = [`local_${cliSessionId}.json`, ...(current === savedFrom && oldLocalId ? [`${oldLocalId}.json`] : [])];
  const file = names.map((name) => join(current, name)).find((path) => existsSync(path));
  if (!file) return undefined;

  const found = toRecord(file);
  return found && archivedIds(current).has(found.localId) ? { ...found, archived: true } : found;
}

/**
 * The local ids the app lists as archived in an account folder's `archived-sessions.idx`, beside each record's own
 * flag.
 *
 * @param {string} dir
 * @returns {Set<string>}
 */
function archivedIds(dir) {
  try {
    const index = JSON.parse(readFileSync(join(dir, "archived-sessions.idx"), "utf8"));
    return new Set(Array.isArray(index?.archived) ? index.archived.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
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

/** How long the app may take to write the record of a session it was asked to open. */
const OPEN_WAIT_MS = Number(process.env.MOKU_OPEN_WAIT_MS ?? 20_000);

/**
 * Whether this process writes to a terminal, the only place `claude --desktop` hands a session to the app. The
 * Bash tool and the `!` prompt of a session are no terminal; the app's Terminal panel (`run_in_terminal`) and
 * Terminal.app are.
 *
 * @returns {boolean}
 */
export function inTerminal() {
  if (process.env.MOKU_FORCE_TTY !== undefined) return process.env.MOKU_FORCE_TTY === "1";
  return Boolean(process.stdout.isTTY);
}

/** The permission modes `claude --permission-mode` takes; `default` is the mode a session gets without the flag. */
export const CLI_PERMISSION_MODES = new Set(["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"]);

/**
 * Open one session in the desktop app under the current sign-in, in the permission mode it had, and wait until the
 * app has written its record. `claude --desktop --resume` hands the session over only from a terminal, so it runs
 * here with this process's own terminal (its output on stderr, which is the terminal too, so stdout stays the report); the earlier way, under `script` with no input, opened none of 13 sessions
 * on 2026-11-11 and 2026-11-15. The answer is the app's record, not the command's exit code.
 *
 * @param {string} cwd
 * @param {string} cliSessionId
 * @param {{ permissionMode?: string | null, accountDir?: string, root?: string }} [options]
 * @returns {{ ok: boolean, record?: DesktopRecord, why?: string }}
 */
export function openInDesktop(cwd, cliSessionId, { permissionMode = null, accountDir, root = desktopRoot() } = {}) {
  const mode = permissionMode && CLI_PERMISSION_MODES.has(permissionMode) ? ["--permission-mode", permissionMode] : [];
  const run = spawnSync("claude", ["--desktop", "--resume", cliSessionId, ...mode], { cwd, stdio: [0, 2, 2], timeout: 60_000 });
  if (run.error) return { ok: false, why: `\`claude\` did not start: ${run.error.message}` };

  const deadline = Date.now() + OPEN_WAIT_MS;
  for (;;) {
    const dir = accountDir ?? currentAccountDir(root);
    const record = dir ? reopenedRecord(root, cliSessionId, undefined, dir) : undefined;
    if (record && !record.archived) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, OPEN_PAUSE_MS);
      return { ok: true, record };
    }
    if (Date.now() >= deadline) return { ok: false, why: run.status === 0 ? `the app wrote no record of it within ${Math.round(OPEN_WAIT_MS / 1000)} s` : `\`claude --desktop\` exited with ${run.status}` };
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
}

/**
 * Write the parent link, the title and the permission mode back into the records of sessions opened again, after
 * copying each record into the backup folder. A parent is set only when the parent was opened again too; nesting of any depth follows,
 * since each session points at its own parent.
 *
 * @param {{ localId: string, cliSessionId: string, title: string, parent: string | null, spawnedFrom: Record<string, any> | null, detached?: boolean, permissionMode?: string | null, file: string }[]} sessions
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
    // A side session the app moved to the top level keeps its parent link but shows at the top: the flag goes too
    const wantsParent = Boolean(parentNow && session.spawnedFrom && !session.detached && (record.spawnedFrom?.sessionId !== parentNow || record.lineageDetached === true));
    const wantsTitle = Boolean(session.title && record.title !== session.title);
    const wantsMode = Boolean(session.permissionMode && record.permissionMode !== session.permissionMode);
    if (!wantsParent && !wantsTitle && !wantsMode) continue;

    copyFileSync(session.file, join(backupDir, basename(session.file)));
    if (wantsParent) {
      record.spawnedFrom = { ...session.spawnedFrom, sessionId: parentNow };
      delete record.lineageDetached;
      delete record.lineageDetachedBy;
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
      detached: data.lineageDetached === true,
      file,
    };
  } catch {
    return undefined;
  }
}
