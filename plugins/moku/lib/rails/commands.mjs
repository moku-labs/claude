/**
 * Command handlers for the `moku-rails` CLI.
 *
 * Each handler takes parsed arguments and returns a Result.
 * Handlers own the ledger edits; decisions are delegated to transitions.mjs and guard.mjs.
 */

import { relative, resolve } from "node:path";

import { guardWrite } from "./guard.mjs";
import { findChange, isInitialized, isMokuProject, loadLedger, newChange, saveLedger } from "./ledger.mjs";
import { reconcile } from "./reconcile.mjs";
import { OPTIONAL_STATIONS, routeFor } from "./routes.mjs";
import { CLOSE_CHECKLIST, canClose, canEnter } from "./transitions.mjs";

/** @typedef {{ code: 0 | 1 | 2, lines: string[], data?: unknown }} Result */
/** @typedef {{ root: string, positional: string[], flags: Record<string, string | true> }} Args */

/** Exit code for "the rails refuse this move". Distinct from 1, a usage or runtime error. */
const REFUSED = 2;

/**
 * Where the project stands: initialized or not, open changes, debts.
 *
 * @param {Args} args
 * @returns {Result}
 * @example
 * status({ root: process.cwd(), positional: [], flags: {} });
 */
export function status({ root }) {
  const ledger = loadLedger(root);
  const initialized = isInitialized(root);
  const debts = reconcile(root, ledger);

  const lines = [initialized ? "Project: initialized." : "Project: NOT initialized. Only intake, brainstorm and design are possible."];
  if (debts.length === 0) lines.push("Rails: clean. Ready for new work.");
  for (const debt of debts) lines.push(`Debt [${debt.kind}]: ${debt.detail}`);
  if (ledger.ideas.length > 0) lines.push(`Backlog: ${ledger.ideas.length} idea(s) parked for later.`);

  return { code: 0, lines, data: { initialized, debts, changes: ledger.changes, ideas: ledger.ideas } };
}

/**
 * Open a change. Refused while another change is stuck inside a station.
 *
 * @param {Args} args flags: --size S|M|L, --type, --title
 * @returns {Result}
 * @example
 * open({ root, positional: ["2026-09-26-streak-midnight"], flags: { size: "S", type: "fix", title: "Streak breaks at midnight" } });
 */
export function open({ root, positional, flags }) {
  const [id] = positional;
  const size = String(flags.size ?? "");
  if (!id || !size) return usage("moku-rails open <id> --size S|M|L --type <type> --title <title>");

  routeFor(/** @type {"S"} */ (size));
  const ledger = loadLedger(root);
  if (ledger.changes.some((change) => change.id === id)) return fail(`Change "${id}" already exists.`);

  // A change abandoned mid-station must be finished or parked first
  const stuck = ledger.changes.find((change) => change.status === "open" && change.station !== null && !change.paused);
  if (stuck) return refused(`Change "${stuck.id}" is still inside station "${stuck.station}". Finish it, or park it with a reason, before opening "${id}".`);

  ledger.changes.push(newChange({ id, size: /** @type {"S"} */ (size), type: String(flags.type ?? "feature"), title: String(flags.title ?? id) }));
  saveLedger(root, ledger);

  return ok(`Opened ${id} (size ${size}). Route: ${routeFor(/** @type {"S"} */ (size)).join(" → ")}.`);
}

/**
 * Enter a station. The single gate every phase skill passes first.
 *
 * @param {Args} args positional: station; flags: --change
 * @returns {Result}
 * @example
 * enter({ root, positional: ["build"], flags: {} }); // code 2 when plan is missing
 */
export function enter({ root, positional, flags }) {
  const [station] = positional;
  if (!station) return usage("moku-rails enter <station> [--change <id>]");

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  const verdict = canEnter({ initialized: isInitialized(root) }, change, station);
  if (!verdict.ok) return { code: REFUSED, lines: [`Refused: ${verdict.reason}`, `Next step: ${verdict.missing}`], data: verdict };

  change.station = station;
  change.paused = false;
  saveLedger(root, ledger);

  return ok(`Entered "${station}" for ${change.id}.`);
}

/**
 * Mark the current station done.
 *
 * @param {Args} args positional: station
 * @returns {Result}
 * @example
 * done({ root, positional: ["plan"], flags: {} });
 */
export function done({ root, positional, flags }) {
  const [station] = positional;
  if (!station) return usage("moku-rails done <station> [--change <id>]");

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  if (change.station !== station) return refused(`Change ${change.id} is not inside "${station}" (it is ${change.station ? `inside "${change.station}"` : "between stations"}). Enter the station before finishing it.`);

  change.station = null;
  if (!change.done.includes(station)) change.done.push(station);
  saveLedger(root, ledger);

  return ok(`Station "${station}" done for ${change.id}.`);
}

/**
 * Skip an optional station on purpose, with the reason recorded.
 *
 * @param {Args} args positional: station; flags: --reason
 * @returns {Result}
 * @example
 * skip({ root, positional: ["design"], flags: { reason: "no UI in this change" } });
 */
export function skip({ root, positional, flags }) {
  const [station] = positional;
  if (!station || !flags.reason) return usage("moku-rails skip <station> --reason <why>");

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  if (!OPTIONAL_STATIONS.has(station)) return refused(`Station "${station}" is required and cannot be skipped.`);

  change.note = `${change.note ? `${change.note} ` : ""}[skipped ${station}: ${flags.reason}]`;
  saveLedger(root, ledger);

  return ok(`Skipped optional station "${station}" for ${change.id}.`);
}

/**
 * Confirm one closing-checklist item.
 *
 * @param {Args} args positional: tests | verify | docs
 * @returns {Result}
 * @example
 * check({ root, positional: ["tests"], flags: {} });
 */
export function check({ root, positional, flags }) {
  const [item] = positional;
  if (!CLOSE_CHECKLIST.includes(item)) return usage(`moku-rails check <${CLOSE_CHECKLIST.join("|")}>`);

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  change.checklist[item] = true;
  saveLedger(root, ledger);

  return ok(`Checklist "${item}" confirmed for ${change.id}.`);
}

/**
 * Close a change. Refused until every required station and checklist item is done.
 *
 * @param {Args} args
 * @returns {Result}
 * @example
 * close({ root, positional: [], flags: {} });
 */
export function close({ root, flags }) {
  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  const verdict = canClose(change);
  if (!verdict.ok) return { code: REFUSED, lines: [`Refused: ${verdict.reason}`, `Next step: ${verdict.missing}`], data: verdict };

  change.status = "closed";
  change.station = null;
  if (!change.done.includes("close")) change.done.push("close");
  saveLedger(root, ledger);

  return ok(`Closed ${change.id}.`);
}

/**
 * Pause the active station while waiting for the user, so stopping is legitimate.
 *
 * @param {Args} args flags: --reason
 * @returns {Result}
 * @example
 * pause({ root, positional: [], flags: { reason: "waiting for the plan approval" } });
 */
export function pause({ root, flags }) {
  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  change.paused = true;
  saveLedger(root, ledger);

  return ok(`Paused ${change.id}${flags.reason ? `: ${flags.reason}` : ""}.`);
}

/**
 * Park a change: an explicit, recorded decision to leave it unfinished.
 *
 * @param {Args} args positional: id; flags: --reason
 * @returns {Result}
 * @example
 * park({ root, positional: ["2026-09-20-friends"], flags: { reason: "after the first release" } });
 */
export function park({ root, positional, flags }) {
  const [id] = positional;
  if (!id || !flags.reason) return usage("moku-rails park <id> --reason <why>");

  const ledger = loadLedger(root);
  const change = findChange(ledger, id);
  change.status = "parked";
  change.station = null;
  change.note = String(flags.reason);
  saveLedger(root, ledger);

  return ok(`Parked ${id}.`);
}

/**
 * Reopen a parked change.
 *
 * @param {Args} args positional: id
 * @returns {Result}
 * @example
 * resume({ root, positional: ["2026-09-20-friends"], flags: {} });
 */
export function resume({ root, positional }) {
  const [id] = positional;
  if (!id) return usage("moku-rails resume <id>");

  const ledger = loadLedger(root);
  const change = findChange(ledger, id);
  if (change.status !== "parked") return refused(`Change ${id} is ${change.status}, not parked.`);

  change.status = "open";
  saveLedger(root, ledger);

  return ok(`Resumed ${id}. Done so far: ${change.done.join(", ") || "nothing"}.`);
}

/**
 * Keep an idea for later so it is not lost and does not derail the current change.
 *
 * @param {Args} args positional: the idea text
 * @returns {Result}
 * @example
 * idea({ root, positional: ["compete with friends"], flags: {} });
 */
export function idea({ root, positional }) {
  const text = positional.join(" ").trim();
  if (!text) return usage("moku-rails idea <text>");

  const ledger = loadLedger(root);
  ledger.ideas.push(text);
  saveLedger(root, ledger);

  return ok(`Idea kept (${ledger.ideas.length} in the backlog).`);
}

/**
 * The write guard, for the PreToolUse hook.
 *
 * @param {Args} args positional: file path
 * @returns {Result}
 * @example
 * guard({ root, positional: ["src/plugins/streak/index.ts"], flags: {} }); // code 2 before init
 */
export function guard({ root, positional }) {
  const [filePath] = positional;
  if (!filePath) return usage("moku-rails guard <file-path>");

  const ledger = loadLedger(root);
  const verdict = guardWrite(relative(root, resolve(root, filePath)), {
    isMokuProject: isMokuProject(root),
    initialized: isInitialized(root),
    changes: ledger.changes,
  });

  return verdict.allow ? ok("allow") : refused(verdict.reason);
}

/**
 * May the session stop now. Refused while a change sits inside a writing station and is not paused.
 *
 * @param {Args} args
 * @returns {Result}
 * @example
 * mayStop({ root, positional: [], flags: {} });
 */
export function mayStop({ root }) {
  const ledger = loadLedger(root);
  const active = ledger.changes.find((change) => change.status === "open" && change.station !== null && !change.paused);
  if (!active) return ok("allow");

  return refused(`Change ${active.id} is inside station "${active.station}". Finish the station, or run \`moku-rails pause --reason <why>\` if you are waiting for the user.`);
}

/** @param {string | true | undefined} value */
function optional(value) {
  return typeof value === "string" ? value : undefined;
}

/** @param {string} line @returns {Result} */
function ok(line) {
  return { code: 0, lines: [line] };
}

/** @param {string} line @returns {Result} */
function refused(line) {
  return { code: REFUSED, lines: [`Refused: ${line}`] };
}

/** @param {string} line @returns {Result} */
function fail(line) {
  return { code: 1, lines: [line] };
}

/** @param {string} line @returns {Result} */
function usage(line) {
  return { code: 1, lines: [`Usage: ${line}`] };
}
