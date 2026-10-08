/**
 * The ledger: `.planning/state.json`, the machine-readable record of where the project stands.
 *
 * One concern: load, save and edit the ledger. Decisions live in transitions.mjs and guard.mjs.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * @typedef {object} Change
 * @property {string} id date-slug, e.g. "2026-09-26-streak-midnight"
 * @property {string} title
 * @property {string} type fix | feature | tweak | refactor | project
 * @property {"S" | "M" | "L"} size
 * @property {"open" | "closed" | "parked"} status
 * @property {string | null} station station currently entered, or null between stations
 * @property {string[]} done stations finished
 * @property {Record<string, boolean>} checklist
 * @property {boolean} paused true while waiting for the user
 * @property {string} [pauseReason] why it waits; kept only while `paused` is true
 * @property {string} [note]
 * @property {string} [startCommit] HEAD when the change was opened; verify scopes its diff from here
 * @property {string[]} [skipped] optional stations skipped on purpose, each with a recorded reason in `note`
 * @property {string[]} [scope] requests added after the change was opened
 * @property {string} [worktree] root of the git worktree the change was opened in; absent for the main checkout
 */

/**
 * @typedef {object} Turn
 * @property {string} promptAt when the person's last request arrived
 * @property {boolean} routed true once a rails command placed that request on the route
 */

/**
 * The ledger as one checkout sees it. Every git worktree of a project shares one `.planning/`, and each
 * worktree is a lane of its own: `changes` holds the changes opened in this lane and `turn` is this lane's
 * last request. What the other lanes hold is in `elsewhere`, to read and never to edit.
 *
 * @typedef {{ version: 1, changes: Change[], ideas: string[], activatedAt?: string, turn?: Turn, elsewhere?: Change[] }} Ledger
 */

/**
 * The file on disk: every lane's changes in one list, and one last request per lane. The main checkout's
 * request stays in `turn`, where it always was, so a ledger written before lanes existed reads the same.
 *
 * @typedef {{ version: 1, changes: Change[], ideas: string[], activatedAt?: string, turn?: Turn, turns?: Record<string, Turn> }} LedgerFile
 */

/** The lane of the main checkout. */
const MAIN_LANE = "";

/** How long a writer waits for another writer, and when a lock left by a dead process is taken over. */
const LOCK_WAIT_MS = 3000;
const LOCK_STALE_MS = 10_000;

const LEDGER_FILE = join(".planning", "state.json");
const LEDGER_NAME = "state.json";
const MARKER_FILE = join(".planning", "moku.md");
const INIT_FILE = join(".planning", ".init-in-progress");

/**
 * Load the ledger, or an empty one when the project has none yet.
 *
 * @param {string} root project root
 * @returns {Ledger}
 * @example
 * loadLedger(process.cwd()).changes.length; // 0 in a fresh project
 */
export function loadLedger(root) {
  const lane = laneOf(root);
  const file = readLedgerFile(root);

  return {
    version: 1,
    changes: file.changes.filter((change) => inLane(change, lane)),
    ideas: file.ideas,
    ...(file.activatedAt ? { activatedAt: file.activatedAt } : {}),
    ...(turnOf(file, lane) ? { turn: turnOf(file, lane) } : {}),
    elsewhere: file.changes.filter((change) => !inLane(change, lane)),
  };
}

/**
 * The lane a checkout works in: its own root when it is a git worktree that got a link to the main
 * checkout's `.planning/`, and the main lane everywhere else.
 *
 * @param {string} root project root
 * @returns {string} "" for the main checkout, the worktree's absolute root otherwise
 * @example
 * laneOf("/work/site"); // ""
 * laneOf("/work/site/.claude/worktrees/fix-streak"); // "/work/site/.claude/worktrees/fix-streak"
 */
export function laneOf(root) {
  try {
    return lstatSync(join(root, ".planning")).isSymbolicLink() ? resolve(root) : MAIN_LANE;
  } catch {
    return MAIN_LANE;
  }
}

/**
 * The one ledger file of the project, wherever the checkout is. A worktree reaches it through links, and a
 * save that renamed a file over a link would cut the worktree off, so every read, save and lock uses the
 * real file in the main checkout's `.planning/`.
 *
 * @param {string} root project root
 * @returns {string} absolute path of the real `state.json`
 */
function ledgerPath(root) {
  let home;
  try {
    home = realpathSync(join(root, ".planning"));
  } catch {
    return join(root, LEDGER_FILE);
  }

  // A lane folder is `.planning/lanes/<name>` of the main checkout
  if (basename(dirname(home)) === "lanes") home = dirname(dirname(home));

  return join(home, LEDGER_NAME);
}

/**
 * Read the ledger file as it is on disk, every lane included. A corrupt file is set aside, never fatal.
 *
 * @param {string} root project root
 * @returns {LedgerFile}
 */
function readLedgerFile(root) {
  const file = ledgerPath(root);
  if (!existsSync(file)) return emptyLedger();

  // A corrupt ledger must never crash a hook: a crashed hook lets every write through unchecked
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    renameSync(file, `${file}.corrupt`);
    console.error(`moku rails: ${LEDGER_FILE} was not valid JSON. It was moved to ${LEDGER_FILE}.corrupt and a fresh ledger was started.`);
    return emptyLedger();
  }
}

/**
 * @param {Change} change
 * @param {string} lane
 * @returns {boolean} whether the change was opened in this lane
 */
function inLane(change, lane) {
  return (change.worktree ?? MAIN_LANE) === lane;
}

/**
 * @param {LedgerFile} file
 * @param {string} lane
 * @returns {Turn | undefined} the last request of this lane
 */
function turnOf(file, lane) {
  return lane === MAIN_LANE ? file.turn : file.turns?.[lane];
}

/** @returns {Ledger} */
function emptyLedger() {
  return { version: 1, changes: [], ideas: [] };
}

/**
 * True while the init station is scaffolding: source writes are allowed, the project is not yet "initialized".
 *
 * @param {string} root project root
 * @returns {boolean}
 * @example
 * isInitializing(process.cwd());
 */
export function isInitializing(root) {
  return existsSync(join(root, INIT_FILE));
}

/**
 * Mark the start or the end of the init station.
 *
 * @param {string} root project root
 * @param {boolean} active
 * @example
 * setInitializing(process.cwd(), true);
 */
export function setInitializing(root, active) {
  const file = join(root, INIT_FILE);
  if (!active) return rmSync(file, { force: true });

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "The init station is scaffolding this project. Removed by `moku-rails init done`.\n");
}

/**
 * Save what this checkout holds. Only this lane's changes and this lane's last request are written: the
 * other lanes are read from the file at the moment of the save, under a lock, so two sessions in two
 * worktrees never overwrite each other. The write is atomic: a sibling temp file, then a rename.
 *
 * @param {string} root project root
 * @param {Ledger} ledger
 * @example
 * saveLedger(process.cwd(), ledger);
 */
export function saveLedger(root, ledger) {
  const lane = laneOf(root);
  const file = ledgerPath(root);
  mkdirSync(dirname(file), { recursive: true });

  const release = lockLedger(file);
  try {
    const disk = readLedgerFile(root);

    // This lane's changes come from the caller, every other lane's from the file
    const mine = ledger.changes.map((change) => (lane === MAIN_LANE ? change : { ...change, worktree: lane }));
    const merged = { ...disk, version: 1, changes: [...disk.changes.filter((change) => !inLane(change, lane)), ...mine], ideas: ledger.ideas };
    if (ledger.activatedAt) merged.activatedAt = ledger.activatedAt;

    // And the same for the last request
    if (lane === MAIN_LANE) {
      if (ledger.turn) merged.turn = ledger.turn;
    } else if (ledger.turn) {
      merged.turns = { ...disk.turns, [lane]: ledger.turn };
    }

    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(merged, null, 2)}\n`);
    renameSync(temp, file);
  } finally {
    release();
  }
}

/** Ledger files this process holds the lock of. */
const heldLocks = new Set();

/**
 * Run one edit of the ledger, from its read to its save, with nobody else writing in between. Two sessions
 * of the same checkout, or a prompt hook and a command, would otherwise each save what they read.
 *
 * @template T
 * @param {string} root project root
 * @param {() => T} edit reads the ledger, changes it and saves it
 * @returns {T} what the edit returned
 * @example
 * withLedger(root, () => { const ledger = loadLedger(root); ledger.ideas.push("x"); saveLedger(root, ledger); });
 */
export function withLedger(root, edit) {
  // A directory that is not on the rails has no ledger to guard, and must not get a `.planning/` from a lock
  if (!existsSync(join(root, ".planning"))) return edit();

  const release = lockLedger(ledgerPath(root));
  try {
    return edit();
  } finally {
    release();
  }
}

/**
 * Take the ledger's write lock: a directory beside the file, because creating a directory is atomic. A lock
 * older than `LOCK_STALE_MS` was left by a process that died, and is taken over. A writer that cannot get
 * the lock in `LOCK_WAIT_MS` writes anyway: a late save is better than a hook that hangs.
 *
 * @param {string} file the ledger file
 * @returns {() => void} releases the lock
 */
function lockLedger(file) {
  // The process already holds it: a whole command is one edit, and its save is inside that edit
  if (heldLocks.has(file)) return () => {};

  const lock = `${file}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (true) {
    try {
      mkdirSync(lock);
      heldLocks.add(file);
      return () => {
        heldLocks.delete(file);
        rmSync(lock, { recursive: true, force: true });
      };
    } catch {
      if (lockAge(lock) > LOCK_STALE_MS) {
        try {
          rmdirSync(lock);
        } catch {
          /* another writer took it over first */
        }
        continue;
      }
      if (Date.now() > deadline) return () => {};

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

/**
 * @param {string} lock
 * @returns {number} milliseconds since the lock was taken, or 0 when it is gone
 */
function lockAge(lock) {
  try {
    return Date.now() - statSync(lock).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Move a change into this checkout's lane: from a worktree that was removed, or to hand work over. The
 * change keeps its station, its checklist and its plan.
 *
 * @param {string} root project root
 * @param {string} id change id
 * @returns {Change | undefined} the change as it is now, or undefined when no other lane holds it
 * @example
 * adoptChange("/work/site", "2026-09-26-streak-midnight");
 */
export function adoptChange(root, id) {
  const ledger = loadLedger(root);
  const change = ledger.elsewhere?.find((entry) => entry.id === id);
  if (!change) return undefined;

  // Saving it as this lane's change removes it from the lane it came from: a change has one lane
  const file = ledgerPath(root);
  const release = lockLedger(file);
  try {
    const disk = readLedgerFile(root);
    disk.changes = disk.changes.filter((entry) => entry.id !== id);
    writeFileSync(file, `${JSON.stringify(disk, null, 2)}\n`);
  } finally {
    release();
  }

  const { worktree: _from, ...moved } = change;
  const fresh = loadLedger(root);
  fresh.changes.push(moved);
  saveLedger(root, fresh);

  return moved;
}

/**
 * True when the init station has run: the project marker exists.
 *
 * @param {string} root project root
 * @returns {boolean}
 * @example
 * isInitialized("/tmp/empty"); // false
 */
export function isInitialized(root) {
  return existsSync(join(root, MARKER_FILE));
}

/**
 * True when the directory is on the rails: a session was started here, or the project is initialized.
 * Nothing else counts. A package.json that names `@moku-labs/*` does not put a repository on the rails,
 * so the hooks stay silent in every project that never asked for them.
 *
 * @param {string} root project root
 * @returns {boolean}
 * @example
 * isOnRails(process.cwd());
 */
export function isOnRails(root) {
  return isInitialized(root) || existsSync(join(root, LEDGER_FILE));
}

/**
 * The nearest directory at or above `start` that is on the rails, or undefined when there is none.
 * Hooks resolve their root from the file being written, so the verdict does not depend on the session's cwd.
 *
 * @param {string} start a directory, absolute or relative to the process cwd
 * @returns {string | undefined}
 * @example
 * findRoot("/work/site/src/islands"); // "/work/site"
 */
export function findRoot(start) {
  let current = resolve(start);

  while (true) {
    if (isOnRails(current)) return current;

    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * Put a directory on the rails. Creates the directory and an empty ledger; an existing ledger is kept.
 *
 * @param {string} root project root
 * @returns {boolean} true when the ledger was created by this call
 * @example
 * activate("/work/site");
 */
export function activate(root) {
  if (existsSync(join(root, LEDGER_FILE))) return false;

  saveLedger(root, { ...emptyLedger(), activatedAt: new Date().toISOString() });
  return true;
}

/**
 * Record that a new request arrived and is not routed yet. Called by the prompt hook.
 *
 * @param {string} root project root
 * @example
 * markPrompt(process.cwd());
 */
export function markPrompt(root) {
  withLedger(root, () => {
    const ledger = loadLedger(root);
    ledger.turn = { promptAt: new Date().toISOString(), routed: false };
    saveLedger(root, ledger);
  });
}

/**
 * Record that the current request was placed on the route. A ledger with no recorded request stays untouched.
 *
 * @param {Ledger} ledger
 * @example
 * markRouted(ledger);
 */
export function markRouted(ledger) {
  if (ledger.turn) ledger.turn.routed = true;
}

/**
 * Find one change. Without an id, the single open change is implied.
 *
 * @param {Ledger} ledger
 * @param {string} [id]
 * @returns {Change}
 * @example
 * findChange(ledger); // the only open change, or throws when ambiguous
 */
export function findChange(ledger, id) {
  if (id) {
    const match = ledger.changes.find((change) => change.id === id);
    const other = ledger.elsewhere?.find((change) => change.id === id);
    if (!match && other) throw new Error(`Change "${id}" belongs to the worktree ${other.worktree ?? "of the main checkout"}. Work on it there, or move it here with \`moku-rails adopt ${id}\`.`);
    if (!match) throw new Error(`No change with id "${id}".`);
    return match;
  }

  const open = ledger.changes.filter((change) => change.status === "open");
  if (open.length === 0) throw new Error("No open change. Open one with `moku-rails open`.");
  if (open.length > 1) throw new Error(`Several changes are open (${open.map((change) => change.id).join(", ")}). Pass --change <id>.`);

  return open[0];
}

/**
 * Build a new change record. Opening a change is its intake, so that station starts out done.
 *
 * @param {{ id: string, title: string, type: string, size: "S" | "M" | "L" }} input
 * @returns {Change}
 * @example
 * newChange({ id: "2026-09-26-streak-midnight", title: "Streak breaks at midnight", type: "fix", size: "S" });
 */
export function newChange(input) {
  return {
    ...input,
    status: "open",
    station: null,
    done: ["intake"],
    checklist: { tests: false, verify: false, docs: false },
    paused: false,
  };
}
