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
 * @param {{ isMokuProject: boolean, hasManifest?: boolean, initialized: boolean, initializing?: boolean, changes: Array<{ status: string, station: string | null }> }} facts
 * @returns {GuardVerdict}
 * @example
 * guardWrite("src/plugins/streak/index.ts", { isMokuProject: false, initialized: false, changes: [] });
 * // { allow: false, reason: "...initialize the project first..." }
 */
export function guardWrite(filePath, facts) {
  const touchesPlugin = PLUGIN_PATH.test(filePath);
  const touchesSource = SOURCE_PATH.test(filePath);

  // A path outside the project root belongs to something else
  if (filePath.startsWith("..")) return { allow: true };

  // Anything outside src/ is not architecture: planning files, docs, configs
  if (!touchesSource) return { allow: true };

  // The init station is the one place that writes source before the project counts as initialized
  if (facts.initializing) return { allow: true };

  // A repository with its own package.json and no @moku-labs dependency is none of our business,
  // even when it has a src/plugins/ folder of its own
  if (!facts.isMokuProject && facts.hasManifest) return { allow: true };

  // No manifest at all: only a plugin path says "someone is starting a moku project here"
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

const SHELL_WRITE = /(^|[\s;&|(])(tee|cp|mv|touch|install|ln)\s|>>?|sed\s+(-[a-zA-Z]*i|--in-place)|<<-?\s*['"]?\w/;
const SOURCE_TOKEN = /(?:^|[\s'"=>(])((?:\.{0,2}\/)?(?:[\w.@-]+\/)*src\/[\w./@\[\]-]*)/g;

/**
 * Decide whether a shell command may run. It is refused when it writes files (redirect, heredoc, tee, cp, mv,
 * touch, sed -i) and names a source path that `guardWrite` would refuse. Closes the "write through Bash" bypass.
 *
 * @param {string} command
 * @param {Parameters<typeof guardWrite>[1]} facts
 * @returns {GuardVerdict}
 * @example
 * guardShell("cat > src/plugins/streak/index.ts <<'EOF'", { isMokuProject: false, initialized: false, changes: [] });
 * // { allow: false, reason: "..." }
 */
export function guardShell(command, facts) {
  if (!SHELL_WRITE.test(command)) return { allow: true };

  // Every source-looking token is checked the way a Write to it would be
  for (const match of command.matchAll(SOURCE_TOKEN)) {
    const verdict = guardWrite(match[1].replace(/^\.\//, ""), facts);
    if (!verdict.allow) return verdict;
  }

  return { allow: true };
}
