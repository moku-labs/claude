/**
 * Write guard: may the agent write this file right now.
 *
 * Used by the PreToolUse hook. Pure decision over a path and the ledger,
 * so the catastrophic case (code before init) is impossible, not just discouraged.
 */

import { WRITING_STATIONS } from "./routes.mjs";

/** @typedef {{ allow: true } | { allow: false, reason: string }} GuardVerdict */

const PLUGIN_PATH = /(?:^|\/)src\/plugins\/([^/]+)\//;
const SOURCE_PATH = /(?:^|\/)src\//;

/**
 * Decide whether a write to `filePath` is allowed.
 *
 * @param {string} filePath project-relative path
 * @param {{ isMokuProject: boolean, initialized: boolean, changes: Array<{ status: string, station: string | null }> }} facts
 * @returns {GuardVerdict}
 * @example
 * guardWrite("src/plugins/streak/index.ts", { isMokuProject: false, initialized: false, changes: [] });
 * // { allow: false, reason: "...initialize the project first..." }
 */
export function guardWrite(filePath, facts) {
  const touchesPlugin = PLUGIN_PATH.test(filePath);
  const touchesSource = SOURCE_PATH.test(filePath);

  // Anything outside src/ is not architecture: planning files, docs, configs
  if (!touchesSource) return { allow: true };

  // A plain non-moku repository is none of our business
  if (!facts.isMokuProject && !touchesPlugin) return { allow: true };

  // Code before init is the catastrophe this guard exists for
  if (!facts.initialized) {
    return deny("This moku project is not initialized yet, so source files written now would not match the architecture. Initialize the project first (the moku conductor does it in one step), then write code.");
  }

  // Source changes travel inside an open change that reached a writing station
  const writing = facts.changes.some((change) => change.status === "open" && WRITING_STATIONS.has(change.station ?? ""));
  if (!writing) {
    return deny("No open change is at a writing station (build, verify, e2e). Open a change with `moku-rails open` and enter its build station first, so the work is tracked and closed properly.");
  }

  return { allow: true };
}

/**
 * @param {string} reason
 * @returns {GuardVerdict}
 */
function deny(reason) {
  return { allow: false, reason };
}
