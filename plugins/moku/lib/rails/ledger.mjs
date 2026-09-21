/**
 * The ledger: `.planning/state.json`, the machine-readable record of where the project stands.
 *
 * One concern: load, save and edit the ledger. Decisions live in transitions.mjs and guard.mjs.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
 */

/**
 * @typedef {object} Turn
 * @property {string} promptAt when the person's last request arrived
 * @property {boolean} routed true once a rails command placed that request on the route
 */

/**
 * @typedef {{ version: 1, changes: Change[], ideas: string[], activatedAt?: string, turn?: Turn }} Ledger
 */

const LEDGER_FILE = join(".planning", "state.json");
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
  const file = join(root, LEDGER_FILE);
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
 * Save the ledger atomically: write a sibling temp file, then rename over the target.
 *
 * @param {string} root project root
 * @param {Ledger} ledger
 * @example
 * saveLedger(process.cwd(), ledger);
 */
export function saveLedger(root, ledger) {
  const file = join(root, LEDGER_FILE);
  const temp = `${file}.tmp`;

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(temp, file);
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
  const ledger = loadLedger(root);
  ledger.turn = { promptAt: new Date().toISOString(), routed: false };
  saveLedger(root, ledger);
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
