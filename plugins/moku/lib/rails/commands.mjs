/**
 * Command handlers for the `moku-rails` CLI.
 *
 * Each handler takes parsed arguments and returns a Result.
 * Handlers own the ledger edits; decisions are delegated to transitions.mjs and guard.mjs.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describeAgents, runningAgents } from "../hooks/agents.mjs";
import { guardShell, guardWrite } from "./guard.mjs";
import { activate, findChange, isInitialized, isInitializing, isOnRails, loadLedger, markRouted, newChange, saveLedger, setInitializing } from "./ledger.mjs";
import { headCommit, reconcile } from "./reconcile.mjs";
import { OPTIONAL_STATIONS, WRITING_STATIONS, routeFor } from "./routes.mjs";
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
  // A directory nobody put on the rails: say so, and name the one step that changes it
  if (!isOnRails(root)) {
    return { code: 0, lines: ["Rails: off. This directory is not on the moku rails, so no hook acts here.", "Next step: the `moku:session` skill (it runs `moku-rails session start`)."], data: { onRails: false, initialized: false, debts: [], changes: [], ideas: [] } };
  }

  const ledger = loadLedger(root);
  const initialized = isInitialized(root);
  const debts = reconcile(root, ledger);

  const lines = [initialized ? "Project: initialized." : "Project: NOT initialized. Only intake, brainstorm and design are possible."];
  if (isInitializing(root)) lines.push("Debt [init]: the init station started and never finished. Finish it with the init skill.");
  if (debts.length === 0) lines.push("Rails: clean. Ready for new work.");
  for (const debt of debts) lines.push(debt.kind === "paused" ? `Paused: ${debt.detail}` : `Debt [${debt.kind}]: ${debt.detail}`);
  if (ledger.ideas.length > 0) lines.push(`Backlog: ${ledger.ideas.length} idea(s) parked for later.`);
  const agents = runningAgents(root);
  if (agents.length > 0) lines.push(`Agents: ${describeAgents(agents)}.`);

  return { code: 0, lines, data: { onRails: true, initialized, debts, changes: ledger.changes, ideas: ledger.ideas, agents } };
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
  if (!isOnRails(root)) return offRails();

  const ledger = loadLedger(root);
  if (ledger.changes.some((change) => change.id === id)) return fail(`Change "${id}" already exists.`);

  // A change abandoned mid-station must be finished or parked first
  const stuck = ledger.changes.find((change) => change.status === "open" && change.station !== null && !change.paused);
  if (stuck) return refused(`Change "${stuck.id}" is still inside station "${stuck.station}". Finish it, or park it with a reason, before opening "${id}".`);

  const change = newChange({ id, size: /** @type {"S"} */ (size), type: String(flags.type ?? "feature"), title: String(flags.title ?? id) });
  change.startCommit = headCommit(root);
  ledger.changes.push(change);
  markRouted(ledger);
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
  if (!isOnRails(root)) return offRails();

  const ledger = loadLedger(root);
  if (!ledger.changes.some((entry) => entry.status === "open")) {
    return { code: REFUSED, lines: ["Refused: no change is open, so there is nothing to move along the rails.", "Next step: open"], data: { ok: false, missing: "open" } };
  }

  const change = findChange(ledger, optional(flags.change));
  const verdict = canEnter({ initialized: isInitialized(root) }, change, station);
  if (!verdict.ok) return { code: REFUSED, lines: [`Refused: ${verdict.reason}`, `Next step: ${verdict.missing}`], data: verdict };

  change.station = station;
  change.paused = false;
  change.pauseReason = undefined;
  markRouted(ledger);
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
  change.skipped = [...new Set([...(change.skipped ?? []), station])];
  saveLedger(root, ledger);

  return ok(`Skipped optional station "${station}" for ${change.id}.`);
}

/**
 * Confirm one closing-checklist item. `tests` runs the project's test script and is refused while it is red;
 * `verify` and `docs` record the verdict of the verify station and of the orchestrating session.
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

  // "tests" is a fact, not a claim: the project's own test script decides
  if (item === "tests") {
    const red = runTests(root);
    if (red) return refused(red);
  }

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
 * Pause the active station while waiting for the user, so stopping is legitimate. Refused while agents
 * spawned from the station are still running: their work is not finished, and stopping would orphan it.
 * `--force` pauses anyway, for an agent record left behind by a crash.
 *
 * @param {Args} args flags: --reason, --force
 * @returns {Result}
 * @example
 * pause({ root, positional: [], flags: { reason: "waiting for the plan approval" } });
 */
export function pause({ root, flags }) {
  const ledger = loadLedger(root);

  // Nothing open means nothing to pause; stopping is already legitimate
  if (!ledger.changes.some((entry) => entry.status === "open")) return ok("Nothing is open, so nothing needs pausing.");

  // Agents still running inside the station finish first
  const agents = runningAgents(root);
  if (agents.length > 0 && flags.force !== true) {
    return refused(`${describeAgents(agents)} inside the station (started ${agents[0].startedAt}). Wait for them and take their reports, then pause. If an agent is gone and its record is stale, run \`moku-rails pause --force\`.`);
  }

  const change = findChange(ledger, optional(flags.change));
  change.paused = true;
  change.pauseReason = typeof flags.reason === "string" ? flags.reason : undefined;
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
  markRouted(ledger);
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

  const verdict = guardWrite(relative(root, resolve(root, filePath)), facts(root));

  return verdict.allow ? ok("allow") : refused(verdict.reason);
}

/**
 * The facts both guards decide on.
 *
 * @param {string} root
 * @returns {import("./guard.mjs").GuardFacts}
 * @example
 * facts(process.cwd()).initialized;
 */
export function facts(root) {
  if (!isOnRails(root)) return { onRails: false, initialized: false, changes: [] };

  const ledger = loadLedger(root);

  return { onRails: true, initialized: isInitialized(root), initializing: isInitializing(root), routed: ledger.turn?.routed, changes: ledger.changes };
}

/**
 * The shell guard, for the PreToolUse hook on Bash.
 *
 * @param {Args} args positional: the command line
 * @returns {Result}
 * @example
 * guardBash({ root, positional: ["echo x > src/main.ts"], flags: {} });
 */
export function guardBash({ root, positional }) {
  const verdict = guardShell(positional.join(" "), facts(root));

  return verdict.allow ? ok("allow") : refused(verdict.reason);
}

/**
 * Start a moku session in a directory: put it on the rails so the hooks act there. Creates the directory when it is new.
 * Safe to repeat. Nothing is scaffolded; that is the init station's work.
 *
 * @param {Args} args positional: start
 * @returns {Result}
 * @example
 * session({ root: "/work/site", positional: ["start"], flags: {} });
 */
export function session({ root, positional }) {
  if (positional[0] !== "start") return usage("moku-rails session start [--root <dir>]");

  mkdirSync(root, { recursive: true });
  const created = activate(root);
  const report = status({ root, positional: [], flags: {} });

  return { code: 0, lines: [`${created ? "Session started" : "Session already active"} in ${root}. The rails and their hooks act here from now on.`, ...report.lines], data: report.data };
}

/**
 * Place the person's request on the route as a continuation of the open change: finishing the current station,
 * applying its findings, or resuming after a pause. Anything the plan does not cover goes through `scope` instead.
 *
 * @param {Args} args flags: --change, --note
 * @returns {Result}
 * @example
 * proceed({ root, positional: [], flags: { note: "apply verify findings 1-3" } });
 */
export function proceed({ root, flags }) {
  const ledger = loadLedger(root);
  if (!ledger.changes.some((entry) => entry.status === "open")) return { code: REFUSED, lines: ["Refused: no change is open, so there is nothing to continue.", "Next step: open"], data: { ok: false, missing: "open" } };

  const change = findChange(ledger, optional(flags.change));
  change.paused = false;
  change.pauseReason = undefined;
  markRouted(ledger);
  saveLedger(root, ledger);

  return ok(`Continuing ${change.id}${change.station ? ` inside "${change.station}"` : " between stations"}.`);
}

/**
 * Record that the person asked for something the open change did not cover. A size M or L change goes back in front
 * of the plan station, so new work gets a spec before builders touch it. A size S change only records the note.
 *
 * @param {Args} args positional: what is new
 * @returns {Result}
 * @example
 * scope({ root, positional: ["rebrand to the deck palette"], flags: {} });
 */
export function scope({ root, positional, flags }) {
  const text = positional.join(" ").trim();
  if (!text) return usage("moku-rails scope <what is new> [--change <id>]");

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  change.scope = [...(change.scope ?? []), text];
  markRouted(ledger);

  // Small changes have no plan station to return to
  const replans = routeFor(change.size).includes("plan");
  if (replans) {
    change.done = change.done.filter((name) => name !== "plan" && !WRITING_STATIONS.has(name));
    change.station = null;
    change.checklist = { tests: false, verify: false, docs: false };
  }

  saveLedger(root, ledger);

  return ok(replans ? `Scope of ${change.id} grew. It is back in front of the plan station: write a delta spec for the new part, then build.` : `Scope note kept for ${change.id}.`);
}

/**
 * Begin or finish the init station. While it runs, source writes are allowed in a project that is not initialized yet.
 * `done` requires the marker the init skill writes as its last step, so a half-finished init never counts.
 *
 * @param {Args} args positional: begin | done
 * @returns {Result}
 * @example
 * init({ root, positional: ["begin"], flags: {} });
 */
export function init({ root, positional }) {
  const [phase] = positional;
  if (phase !== "begin" && phase !== "done") return usage("moku-rails init <begin|done>");

  if (phase === "begin") {
    activate(root);
    setInitializing(root, true);
    return ok("Init station started. Source writes are allowed until `moku-rails init done`.");
  }

  if (!isInitialized(root)) return refused("The project marker .planning/moku.md is missing. Write it as the last step of init, then run `moku-rails init done`.");

  setInitializing(root, false);
  return ok("Init station done. The project is initialized.");
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

/** Longest the test script may run before the check gives up. */
const TEST_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Run the project's `test` script. `node --run` needs no package manager, so the rails stay runtime-neutral.
 *
 * @param {string} root
 * @returns {string | undefined} the refusal reason when the tests are red, otherwise undefined
 */
function runTests(root) {
  const run = spawnSync(process.execPath, ["--run", "test"], { cwd: root, encoding: "utf8", timeout: TEST_TIMEOUT_MS });
  if (run.status === 0) return undefined;

  const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n").slice(-15).join("\n");

  return `The test script is red (exit ${run.status ?? "timeout"}), so "tests" stays unconfirmed. Fix the tests, then run the check again.\n${tail}`;
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

/**
 * A change cannot start where no session was started: opening one silently would put a directory on the rails
 * that nobody chose.
 *
 * @returns {Result}
 */
function offRails() {
  return { code: REFUSED, lines: ["Refused: this directory is not on the moku rails.", "Next step: session (the `moku:session` skill settles the directory and runs `moku-rails session start`)."], data: { ok: false, missing: "session" } };
}

/** @param {string} line @returns {Result} */
function fail(line) {
  return { code: 1, lines: [line] };
}

/** @param {string} line @returns {Result} */
function usage(line) {
  return { code: 1, lines: [`Usage: ${line}`] };
}
