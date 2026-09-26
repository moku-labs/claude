/**
 * Write guard: may the agent write this file right now.
 *
 * Used by the PreToolUse hook. Pure decision over a path and the ledger,
 * so the catastrophic case (code before init) is impossible, not just discouraged.
 */

import { WRITING_STATIONS } from "./routes.mjs";
import { shellWriteTargets } from "./shell.mjs";

/** @typedef {{ allow: true } | { allow: false, reason: string }} GuardVerdict */

const SOURCE_PATH = /(?:^|\/)src\//;

/**
 * @typedef {object} GuardFacts
 * @property {boolean} onRails the directory has a ledger or the project marker; without it the guard has no opinion
 * @property {boolean} initialized
 * @property {boolean} [initializing]
 * @property {boolean} [routed] false while the person's last request has not been placed on the route
 * @property {boolean} [subagent] true when the writer is a subagent the orchestrator spawned from the station
 * @property {Array<{ status: string, station: string | null }>} changes
 */

/**
 * Decide whether a write to `filePath` is allowed.
 *
 * @param {string} filePath project-relative path
 * @param {GuardFacts} facts
 * @returns {GuardVerdict}
 * @example
 * guardWrite("src/plugins/streak/index.ts", { onRails: true, initialized: false, changes: [] });
 * // { allow: false, reason: "...initialize the project first..." }
 */
export function guardWrite(filePath, facts) {
  // A path outside the project root belongs to something else
  if (filePath.startsWith("..")) return { allow: true };

  // Anything outside src/ is not architecture: planning files, docs, configs
  if (!SOURCE_PATH.test(filePath)) return { allow: true };

  // A directory nobody put on the rails is none of our business, whatever its package.json names
  if (!facts.onRails) return { allow: true };

  // The init station is the one place that writes source before the project counts as initialized
  if (facts.initializing) return { allow: true };

  // Code before init is the catastrophe this guard exists for
  if (!facts.initialized) {
    return deny("This moku project is not initialized yet, so source files written now would not match the architecture. Initialize the project first (the moku conductor does it in one step), then write code.");
  }

  // Source changes travel inside an open change that reached a writing station
  const writing = facts.changes.some((change) => change.status === "open" && WRITING_STATIONS.has(change.station ?? ""));
  if (!writing) {
    return deny("No open change is at a writing station (build, verify, e2e). Open a change with `moku-rails open` and enter its build station first, so the work is tracked and closed properly.");
  }

  // An open change is not a free pass: every new request of the person is placed on the route before code
  // follows it. A subagent was spawned from the station after that routing, so the flag does not apply to it:
  // a message that arrives while it runs must not stop it mid-file.
  if (facts.routed === false && !facts.subagent) {
    return deny("The person's last request has not been routed yet. Load the `moku:moku` skill and place the request: `moku-rails continue` when it finishes work of the current station, `moku-rails scope \"<what is new>\"` when it adds something the plan does not cover, or `moku-rails open` for a separate change.");
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

/**
 * Decide whether a shell command may run. It is refused when a file it writes (a redirect target, or an operand
 * of tee, cp, mv, touch, install, ln, sed -i) is one `guardWrite` would refuse. Closes the "write through Bash"
 * bypass. Only write targets are judged: source paths in a heredoc body, a pattern or a read are not writes.
 *
 * @param {string} command
 * @param {GuardFacts} facts
 * @param {(target: string) => string} [locate] turns a target as written in the command into a project-relative path
 * @returns {GuardVerdict}
 * @example
 * guardShell("cat > src/plugins/streak/index.ts <<'EOF'", { onRails: true, initialized: false, changes: [] });
 * // { allow: false, reason: "..." }
 */
export function guardShell(command, facts, locate = (target) => target) {
  // Every file the command writes is checked the way a Write to it would be
  for (const target of shellWriteTargets(command)) {
    const verdict = guardWrite(locate(target).replace(/^\.\//, ""), facts);
    if (!verdict.allow) return verdict;
  }

  return { allow: true };
}
