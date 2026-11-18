/**
 * Desktop app: what the Claude desktop app keeps of its Code tab sessions, read from its own files, and the two ways
 * a session is changed there: opened with `claude --desktop --resume`, or its files written while the app is closed.
 *
 * One concern: the app's files. Their layout is not a documented interface, so they are read as data and written
 * only by `writeOffline`, after a backup, with the app closed (it keeps them in memory and writes them back).
 *
 * Layout under `~/Library/Application Support/Claude`:
 * - `claude-code-sessions/<account>/<org>/local_<id>.json`: one record per session. `isArchived` hides it from the
 *   sidebar, `spawnedFrom.sessionId` nests it under its parent unless `lineageDetached`, `cwd` and `worktreeName`
 *   say which folder it works in. `archived-sessions.idx` lists the archived ids again.
 * - `git-worktrees.json`: every worktree the app made, by name; `leasedBy` is the local id of the session that may
 *   check its branch out. A lease held by an id the account does not have makes every turn of the session fail with
 *   "this session's branch is checked out somewhere else" (2026-11-18).
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

/**
 * @typedef {object} AppRecord
 * @property {string} file
 * @property {Record<string, any>} data the record as the app wrote it
 * @property {string} localId
 * @property {string} cli the Claude Code session id, the one `claude --resume` takes
 * @property {boolean} archived by the record's flag or the archive index
 */

/**
 * @typedef {object} Account
 * @property {string} dir `<sessions root>/<account>/<org>`
 * @property {string} key `<account>/<org>`
 * @property {AppRecord[]} records every record, archived ones included
 */

/**
 * The folder the app keeps its Code tab sessions in: `MOKU_DESKTOP_SESSIONS`, or the app's own folder.
 *
 * @returns {string}
 */
export function desktopRoot() {
  return process.env.MOKU_DESKTOP_SESSIONS || join(homedir(), "Library", "Application Support", "Claude", "claude-code-sessions");
}

/**
 * The app's registry of worktrees, beside the sessions folder.
 *
 * @param {string} [root]
 * @returns {string}
 */
export function worktreesFile(root = desktopRoot()) {
  return join(dirname(root), "git-worktrees.json");
}

/**
 * The `<account>/<org>` of the current sign-in: `--account`, `MOKU_DESKTOP_ACCOUNT`, or the account and organization
 * the running session names when the app keeps a folder for it (a session inside the app always has its own record
 * there). Otherwise the folder with the most recently active record; `--offline`, which runs outside the app, never
 * relies on that and needs `--account`.
 *
 * @param {string} [named] `<account>/<org>` given on the command line
 * @param {string} [root]
 * @returns {string | undefined}
 * @example
 * currentAccountKey(); // "519d6a7b-…/0387cbe6-…"
 */
export function currentAccountKey(named, root = desktopRoot()) {
  if (named) return named;
  if (process.env.MOKU_DESKTOP_ACCOUNT) return process.env.MOKU_DESKTOP_ACCOUNT;
  // The running session names its account; the app has a folder for it as soon as that session has a record
  const account = process.env.CLAUDE_CODE_ACCOUNT_UUID;
  const org = process.env.CLAUDE_CODE_ORGANIZATION_UUID;
  if (account && org && existsSync(join(root, account, org))) return `${account}/${org}`;

  let newest;
  for (const key of accountKeys(root)) {
    for (const record of readAccount(key, root).records) {
      const at = Number(record.data.lastActivityAt) || 0;
      if (!newest || at > newest.at) newest = { key, at };
    }
  }
  return newest?.key ?? (account && org ? `${account}/${org}` : undefined);
}

/**
 * Every record of one account, with the archive index applied.
 *
 * @param {string} key `<account>/<org>`
 * @param {string} [root]
 * @returns {Account}
 */
export function readAccount(key, root = desktopRoot()) {
  const dir = join(root, key);
  if (!existsSync(dir)) return { dir, key, records: [] };

  const archived = archiveIndex(dir).ids;
  const records = [];
  for (const name of readdirSync(dir).filter((entry) => entry.startsWith("local_") && entry.endsWith(".json"))) {
    const file = join(dir, name);
    const data = readJson(file);
    if (!data || typeof data.cliSessionId !== "string" || !data.cliSessionId) continue;

    const localId = typeof data.sessionId === "string" ? data.sessionId : basename(name, ".json");
    records.push({ file, data, localId, cli: data.cliSessionId, archived: data.isArchived === true || archived.has(localId) });
  }
  return { dir, key, records };
}

/**
 * The archive index of an account folder: `{ v, archived: [local ids] }`.
 *
 * @param {string} dir
 * @returns {{ file: string, v: number, ids: Set<string> }}
 */
export function archiveIndex(dir) {
  const file = join(dir, "archived-sessions.idx");
  const data = readJson(file);
  const ids = Array.isArray(data?.archived) ? data.archived.filter((id) => typeof id === "string") : [];
  return { file, v: typeof data?.v === "number" ? data.v : 1, ids: new Set(ids) };
}

/**
 * The app's worktree registry: name → entry. Empty when the app keeps none.
 *
 * @param {string} [file]
 * @returns {Record<string, Record<string, any>>}
 */
export function readWorktrees(file = worktreesFile()) {
  const data = readJson(file);
  return data && typeof data.worktrees === "object" && data.worktrees ? data.worktrees : {};
}

/**
 * Whether the desktop app is running. Its files must not be written while it runs.
 *
 * @returns {boolean}
 */
export function desktopAppRunning() {
  if (process.env.MOKU_DESKTOP_RUNNING !== undefined) return process.env.MOKU_DESKTOP_RUNNING === "1";

  const run = spawnSync("ps", ["-axo", "comm="], { encoding: "utf8" });
  return run.status === 0 && run.stdout.split("\n").some((line) => /\/Claude\.app\/Contents\/MacOS\/Claude$/.test(line.trim()));
}

/**
 * Whether this process writes to a terminal, the only place `claude --desktop` hands a session to the app. The Bash
 * tool is none; the app's Terminal panel (`run_in_terminal`) is.
 *
 * @returns {boolean}
 */
export function inTerminal() {
  if (process.env.MOKU_FORCE_TTY !== undefined) return process.env.MOKU_FORCE_TTY === "1";
  return Boolean(process.stdout.isTTY);
}

/** How long the app may take to write the record of a session it was asked to open. */
const OPEN_WAIT_MS = Number(process.env.MOKU_OPEN_WAIT_MS ?? 30_000);

/** The pause after a session opened, so the app settles before the next one. */
const OPEN_PAUSE_MS = Number(process.env.MOKU_OPEN_PAUSE_MS ?? 2000);

/**
 * Open one session in the app under the current sign-in and wait until the account has a record of it that is not
 * archived. Never with `--permission-mode`: `claude --desktop` refuses it ("can't be combined", 2026-11-18), and the
 * mode is written afterwards. The command's exit code says nothing; the record is the answer.
 *
 * @param {string} cwd the folder it opens in
 * @param {string} cli
 * @param {string} key the current `<account>/<org>`
 * @param {string} [root]
 * @returns {{ ok: boolean, localId?: string, why?: string }}
 */
export function openInDesktop(cwd, cli, key, root = desktopRoot()) {
  const command = process.env.MOKU_CLAUDE_BIN || "claude";
  const run = spawnSync(command, ["--desktop", "--resume", cli], { cwd, stdio: [0, 2, 2], timeout: 90_000 });
  if (run.error) return { ok: false, why: `\`${command}\` did not start: ${run.error.message}` };

  const deadline = Date.now() + OPEN_WAIT_MS;
  for (;;) {
    const record = readAccount(key, root).records.find((entry) => entry.cli === cli && !entry.archived);
    if (record) {
      sleep(OPEN_PAUSE_MS);
      return { ok: true, localId: record.localId };
    }
    if (Date.now() >= deadline) return { ok: false, why: run.status === 0 ? `the app wrote no record of it within ${Math.round(OPEN_WAIT_MS / 1000)} s` : `\`claude --desktop --resume\` exited with ${run.status}` };
    sleep(250);
  }
}

/**
 * @typedef {object} OfflineEdit
 * @property {string} file a session record
 * @property {Record<string, any>} set fields to write
 * @property {string[]} unset fields to remove
 */

/**
 * Write record edits, worktree leases and archive-index additions, the app closed. Every file is copied into the
 * backup folder first, written to a temporary file, parsed back and renamed over the old one, so a half-written
 * file is never left behind.
 *
 * @param {{ edits: OfflineEdit[], leases: { name: string, to: string }[], archive: { dir: string, ids: string[] }[] }} plan
 * @param {string} backupDir
 * @param {string} [registry] the worktree registry
 * @returns {string[]} the files written
 */
export function writeOffline(plan, backupDir, registry = worktreesFile()) {
  mkdirSync(backupDir, { recursive: true });
  const written = [];
  const save = (/** @type {string} */ file, /** @type {unknown} */ data) => {
    if (existsSync(file)) copyFileSync(file, join(backupDir, basename(file)));
    const text = JSON.stringify(data);
    JSON.parse(text);
    writeFileSync(`${file}.moku-tmp`, text);
    renameSync(`${file}.moku-tmp`, file);
    written.push(file);
  };

  for (const edit of plan.edits) {
    const data = readJson(edit.file);
    if (!data) throw new Error(`${edit.file} does not parse: nothing written to it`);
    Object.assign(data, edit.set);
    for (const key of edit.unset) delete data[key];
    save(edit.file, data);
  }

  if (plan.leases.length > 0) {
    const data = readJson(registry);
    if (!data?.worktrees) throw new Error(`${registry} does not parse: no lease written`);
    for (const { name, to } of plan.leases) {
      const entry = data.worktrees[name];
      if (!entry) continue;
      entry.leasedBy = to;
      delete entry.leaseCleared;
      delete entry.pooledAt;
    }
    save(registry, data);
  }

  for (const { dir, ids } of plan.archive) {
    if (ids.length === 0) continue;
    const index = archiveIndex(dir);
    save(index.file, { v: index.v, archived: [...new Set([...index.ids, ...ids])] });
  }

  return written;
}

/**
 * The `<account>/<org>` keys under the sessions root.
 *
 * @param {string} root
 * @returns {string[]}
 */
function accountKeys(root) {
  if (!existsSync(root)) return [];
  const dirs = (/** @type {string} */ dir) => readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  return dirs(root).flatMap((account) => dirs(join(root, account)).map((org) => `${account}/${org}`));
}

/**
 * @param {string} file
 * @returns {any}
 */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** @param {number} ms */
function sleep(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
