/**
 * The ledger: `.planning/state.json`, the machine-readable record of where the project stands.
 *
 * One concern: load, save and edit the ledger. Decisions live in transitions.mjs and guard.mjs.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
 * @property {string} [note]
 */

/** @typedef {{ version: 1, changes: Change[], ideas: string[] }} Ledger */

const LEDGER_FILE = join(".planning", "state.json");
const MARKER_FILE = join(".planning", "moku.md");

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
  if (!existsSync(file)) return { version: 1, changes: [], ideas: [] };

  return JSON.parse(readFileSync(file, "utf8"));
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
 * True when the directory looks like a moku project, initialized or not.
 *
 * @param {string} root project root
 * @returns {boolean}
 * @example
 * isMokuProject(process.cwd());
 */
export function isMokuProject(root) {
  if (isInitialized(root)) return true;

  const manifest = join(root, "package.json");
  if (!existsSync(manifest)) return false;

  return readFileSync(manifest, "utf8").includes("@moku-labs/");
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
 * Build a new change record.
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
    done: [],
    checklist: { tests: false, verify: false, docs: false },
    paused: false,
  };
}
