/**
 * Command handlers for the `moku-rails` CLI.
 *
 * Each handler takes parsed arguments and returns a Result.
 * Handlers own the ledger edits; decisions are delegated to transitions.mjs and guard.mjs.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describeAgents, runningAgents } from "../hooks/agents.mjs";
import { guardShell, guardWrite } from "./guard.mjs";
import { activate, adoptChange, findChange, isInitialized, isInitializing, isOnRails, loadLedger, markRouted, newChange, projectType, saveLedger, setInitializing } from "./ledger.mjs";
import { cleanHead, headCommit, reconcile } from "./reconcile.mjs";
import { LOOP_STATIONS, OPTIONAL_STATIONS, WRITING_STATIONS, routeFor, tweakTier } from "./routes.mjs";
import { CLOSE_CHECKLIST, canClose, canEnter } from "./transitions.mjs";
import { isDone, markWave, nextWave, readWaves } from "./waves.mjs";

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

  // A plan with waves: the next one is named here, so nobody has to work it out from the tables by eye
  const stateFile = resolve(root, ".planning", "STATE.md");
  if (existsSync(stateFile)) {
    const read = readWaves(readFileSync(stateFile, "utf8"));
    const next = nextWave(read.waves);
    const hasTable = read.waves.length > 0;

    if (hasTable && read.problems.length > 0) lines.push(`Waves: the plan's wave table cannot be built from. ${read.problems.join(" ")}`);
    else if (hasTable && next?.framework) lines.push(`Waves: next is wave ${next.wave}, framework work (${next.framework}), done by hand with no builder.`);
    else if (hasTable && next) lines.push(`Waves: next is wave ${next.wave} (${next.plugins.map((plugin) => plugin.name).join(", ")})${next.plugins.length > 1 ? `, ${next.plugins.length} plugins that may be built in parallel` : ""}. \`moku-rails waves\` lists every wave.`);
  }

  // Work in the other checkouts of this project is theirs: named, so nobody opens it twice, and never a debt here
  const elsewhere = (ledger.elsewhere ?? []).filter((change) => change.status === "open");
  for (const change of elsewhere) {
    const where = change.worktree ?? "the main checkout";
    const gone = change.worktree && !existsSync(change.worktree) ? " That worktree is gone: move the change here with `moku-rails adopt " + change.id + "`." : "";
    lines.push(`Elsewhere: ${change.id} is open in ${where}${change.station ? `, inside "${change.station}"` : ""}.${gone}`);
  }

  return { code: 0, lines, data: { onRails: true, initialized, debts, changes: ledger.changes, ideas: ledger.ideas, agents, elsewhere } };
}

/**
 * Open a change. Refused while another change is stuck inside a station.
 *
 * @param {Args} args flags: --size Q|S|M|L, --type, --title
 * @returns {Result}
 * @example
 * open({ root, positional: ["2026-09-26-streak-midnight"], flags: { size: "S", type: "fix", title: "Streak breaks at midnight" } });
 */
export function open({ root, positional, flags }) {
  const [id] = positional;
  const size = String(flags.size ?? "");
  if (!id || !size) return usage("moku-rails open <id> --size Q|S|M|L --type <type> --title <title>");

  routeFor(/** @type {"S"} */ (size));
  if (!isOnRails(root)) return offRails();

  const ledger = loadLedger(root);
  if (ledger.changes.some((change) => change.id === id)) return fail(`Change "${id}" already exists.`);
  const taken = ledger.elsewhere?.find((change) => change.id === id);
  if (taken) return fail(`Change "${id}" already exists in ${taken.worktree ?? "the main checkout"}. Pick another id.`);

  // A change abandoned mid-station must be finished or parked first
  const stuck = ledger.changes.find((change) => change.status === "open" && change.station !== null && !change.paused && !LOOP_STATIONS.has(change.station));
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
 * One green run confirms `tests` for every change closed on the same tree. The tree is named by its HEAD
 * commit while nothing is uncommitted; the ledger keeps the commit of the last green run, and a check on
 * that commit does not run the script again. A commit or an edit names another tree, so the script runs.
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
  if (item !== "tests") return confirm(root, ledger, change, item);

  // The script already passed on this very tree: one green run is enough for every change closed on it
  const tree = cleanHead(root);
  if (tree !== undefined && ledger.testsGreenAt === tree) return confirm(root, ledger, change, item, ` (green on ${tree.slice(0, 7)}, not run again)`);

  // A red run confirms nothing, and what an earlier run proved is no longer trusted
  const red = runTests(root);
  if (red) {
    ledger.testsGreenAt = undefined;
    saveLedger(root, ledger);
    return refused(red);
  }

  // Remember the tree only when it is still the one the run started on
  ledger.testsGreenAt = cleanHead(root) === tree ? tree : undefined;

  return confirm(root, ledger, change, item);
}

/**
 * Record a confirmed checklist item.
 *
 * @param {string} root
 * @param {import("./ledger.mjs").Ledger} ledger
 * @param {import("./ledger.mjs").Change} change
 * @param {string} item
 * @param {string} [how] what the confirmation rests on, when it is not a fresh run
 * @returns {Result}
 */
function confirm(root, ledger, change, item, how = "") {
  change.checklist[item] = true;
  saveLedger(root, ledger);

  return ok(`Checklist "${item}" confirmed for ${change.id}${how}.`);
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
 * Pause the active station while waiting for the user, so stopping is legitimate. Agents spawned from the
 * station keep running and keep their gate: a pause never closes it for them, and the pause only warns that
 * they are still out, so their hand-backs are expected. `--force` is accepted and changes nothing.
 *
 * @param {Args} args flags: --reason
 * @returns {Result}
 * @example
 * pause({ root, positional: [], flags: { reason: "waiting for the plan approval" } });
 */
export function pause({ root, flags }) {
  const ledger = loadLedger(root);

  // Nothing open means nothing to pause; stopping is already legitimate
  if (!ledger.changes.some((entry) => entry.status === "open")) return ok("Nothing is open, so nothing needs pausing.");

  const change = findChange(ledger, optional(flags.change));
  change.paused = true;
  change.pauseReason = typeof flags.reason === "string" ? flags.reason : undefined;
  saveLedger(root, ledger);

  // Agents still running inside the station are not stopped by the pause; their reports are still to come
  const agents = runningAgents(root);
  const lines = [`Paused ${change.id}${flags.reason ? `: ${flags.reason}` : ""}.`];
  if (agents.length > 0) lines.push(`Warning: ${describeAgents(agents)} inside the station (started ${agents[0].startedAt}). The pause does not stop them and does not close their gate; take their reports when they arrive. A record left behind by an agent that crashed is a file under .planning/agents/; delete it.`);

  return { code: 0, lines };
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
 * Move a change from another worktree into this checkout: the worktree was removed, or the work is handed over.
 *
 * @param {Args} args positional: id
 * @returns {Result}
 * @example
 * adopt({ root, positional: ["2026-09-26-streak-midnight"], flags: {} });
 */
export function adopt({ root, positional }) {
  const [id] = positional;
  if (!id) return usage("moku-rails adopt <id>");
  if (!isOnRails(root)) return offRails();

  const change = adoptChange(root, id);
  if (!change) return refused(`No other checkout holds a change "${id}". \`moku-rails status\` lists them under "Elsewhere".`);

  return ok(`Adopted ${id} into this checkout${change.station ? `, inside "${change.station}"` : ""}. Done so far: ${change.done.join(", ") || "nothing"}.`);
}

/**
 * The build waves of this checkout's plan, read from `.planning/STATE.md`, and the wave to build next.
 * The plugins of one wave live in their own folders and wait for nothing still open, so they are built at
 * the same time.
 *
 * @param {Args} args flags: --done <n> marks wave n and its plugins `verified` first
 * @returns {Result} one line per wave, then the next one; `data.next` holds its plugins with tier and spec
 * @example
 * waves({ root, positional: [], flags: {} }); // lines: ["Wave 0: log, env (verified)", "Wave 1: router, site (not started)", "Next: wave 1, 2 plugins in parallel."]
 */
export function waves({ root, flags }) {
  if (!isOnRails(root)) return offRails();

  const file = resolve(root, ".planning", "STATE.md");
  if (!existsSync(file)) return refused("No .planning/STATE.md here: this checkout has no plan yet. The plan station writes it.");

  // `--done <n>`: the wave passed its checks, so the next call names the wave after it
  const finished = optional(flags.done);
  if (finished !== undefined) {
    if (!/^\d+$/.test(finished)) return usage("moku-rails waves [--done <wave number>]");
    writeFileSync(file, markWave(readFileSync(file, "utf8"), Number(finished), "verified"));
  }

  const read = readWaves(readFileSync(file, "utf8"));
  if (read.problems.length > 0) return refused(read.problems.join(" "));

  const lines = read.waves.map((wave) => `Wave ${wave.wave}: ${wave.framework ? `framework work (${wave.framework})` : wave.plugins.map((plugin) => plugin.name).join(", ")} (${isDone(wave) ? "done" : wave.status || "not started"})`);
  const next = nextWave(read.waves);

  if (!next) lines.push("Every wave is done.");
  else if (next.framework) lines.push(`Next: wave ${next.wave} is framework work with no plugin folder. The orchestrator does it by hand, no builder runs.`);
  else lines.push(`Next: wave ${next.wave}, ${next.plugins.length} plugin(s)${next.plugins.length > 1 ? " in parallel" : ""}.`);

  return { code: 0, lines, data: { waves: read.waves, next: next ?? null } };
}

/**
 * Say who makes a quick edit: the fast agent or the builder. Counted from the files the edit touches.
 *
 * @param {Args} args positional: project-relative files; flags: --misses <n>
 * @returns {Result} one line: `fast`, or `deep: <reasons>`
 * @example
 * tier({ root, positional: ["src/plugins/hud/view.ts"], flags: {} }); // lines: ["fast"]
 */
export function tier({ root, positional, flags }) {
  const misses = Number(optional(flags.misses) ?? 0);
  const verdict = tweakTier(positional, { exists: (path) => existsSync(resolve(root, path)), misses: Number.isFinite(misses) ? misses : 0 });

  return { code: 0, lines: [verdict.tier === "fast" ? "fast" : `deep: ${verdict.reasons.join("; ")}`], data: verdict };
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

  return { onRails: true, initialized: isInitialized(root), initializing: isInitializing(root), game: projectType(root) === "game", routed: ledger.turn?.routed, agentsRunning: runningAgents(root).length > 0, changes: ledger.changes };
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
 * May the session stop now. Refused while a change sits inside a writing station and is not paused, unless
 * agents spawned from the station are still running: then the turn ends to wait for them.
 *
 * @param {Args} args
 * @returns {Result}
 * @example
 * mayStop({ root, positional: [], flags: {} });
 */
export function mayStop({ root }) {
  const ledger = loadLedger(root);
  const active = ledger.changes.find((change) => change.status === "open" && change.station !== null && !change.paused && !LOOP_STATIONS.has(change.station));
  if (!active) return ok("allow");
  if (runningAgents(root).length > 0) return ok("allow: agents are running inside the station, the turn ends to wait for them");

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
