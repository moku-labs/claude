/**
 * Command handlers for the `moku-rails` CLI.
 *
 * Each handler takes parsed arguments and returns a Result.
 * Handlers own the ledger edits; decisions are delegated to transitions.mjs and guard.mjs.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describeAgents, runningAgents } from "../hooks/agents.mjs";
import { PROJECT_TYPES, adoptProject, detectProject, planningIgnored } from "./adopt.mjs";
import { commitHook } from "./commit-hook.mjs";
import { guardShell, guardWrite } from "./guard.mjs";
import { DEFAULT_SINCE_HOURS, artifactWhere, checkpointFolder, checkpointsDir, collectSessions, configDir, describeSession, driftNotes, idMap, latestCheckpoint, parentsFirst, readCheckpoint, reopenedSessions, resumeCommand, resumeMessages, sameCheckpoint, writeCheckpoint } from "./checkpoint.mjs";
import { currentAccountDir, desktopAppRunning, desktopRoot, openInDesktop, relinkSessions } from "./desktop.mjs";
import { activate, adoptChange, findChange, isInitialized, isInitializing, isOnRails, loadLedger, markRouted, newChange, projectType, saveLedger, setInitializing } from "./ledger.mjs";
import { applyAccess, applyCommand, offerLines, offerOnce, planningAccess, userSettingsFile } from "./planning-access.mjs";
import { cleanHead, headCommit, reconcile } from "./reconcile.mjs";
import { LOOP_STATIONS, OPTIONAL_STATIONS, WRITING_STATIONS, routeFor, tweakTier } from "./routes.mjs";
import { STAGES_FILE, currentStage, readStages, splitOffer, splitSignal, stageLine, stagesText, weakDod } from "./stages.mjs";
import { parseTestOutput, readings } from "./test-output.mjs";
import { reportLines, slowOffer, statusLine } from "./test-report.mjs";
import { appendRun, earlierRun, fullKey, readRuns, saveOutput, slowThreshold, summarize, treeKey } from "./test-runs.mjs";
import { CLOSE_CHECKLIST, canClose, canEnter, canFinish } from "./transitions.mjs";
import { COMMAND_USAGE } from "./usage.mjs";
import { isDone, markWave, nextWave, readWaves } from "./waves.mjs";
import { carryFiles, changedFiles, prepareFolder, samePath } from "./worktrees.mjs";

/** @typedef {{ code: 0 | 1 | 2, lines: string[], data?: unknown }} Result */
/** @typedef {{ root: string, positional: string[], flags: Record<string, string | true> }} Args */

/** Exit code for "the rails refuse this move". Distinct from 1, a usage or runtime error. */
const REFUSED = 2;

/** This CLI, by absolute path: the line a person types after `!` must not depend on their PATH. */
const RAILS_BIN = fileURLToPath(new URL("../../bin/moku-rails", import.meta.url));

/** `status` speaks of the test runs of the last day; `tests` has the whole log. */
const RECENT_TESTS_MS = 24 * 60 * 60 * 1000;

/**
 * Where the project stands: initialized or not, open changes, debts.
 *
 * @param {Args} args
 * @returns {Result}
 * @example
 * status({ root: process.cwd(), positional: [], flags: {} });
 */
export function status({ root }) {
  // Moku code without a marker is a project made elsewhere: a fresh clone, or a second person's checkout
  const adoptable = isInitialized(root) || isInitializing(root) ? undefined : detectProject(root)?.type;

  // A directory nobody put on the rails: say so, and name the one step that changes it
  if (!isOnRails(root)) {
    const next = adoptable ? `This is a moku ${adoptable} project with no .planning/ here. Next step: the \`moku:session\` skill, then \`moku-rails adopt\` (not init: the project exists).` : "Next step: the `moku:session` skill (it runs `moku-rails session start`).";
    return { code: 0, lines: ["Rails: off. This directory is not on the moku rails, so no hook acts here.", next], data: { onRails: false, initialized: false, ...(adoptable ? { adoptable } : {}), debts: [], changes: [], ideas: [] } };
  }

  const ledger = loadLedger(root);
  const initialized = isInitialized(root);
  const debts = reconcile(root, ledger);

  const uninitialized = adoptable ? `Project: NOT initialized here, but the directory holds a moku ${adoptable} project. Next step: \`moku-rails adopt\`, which writes only .planning/ (not init: the project exists).` : "Project: NOT initialized. Only intake, brainstorm and design are possible.";
  const lines = [initialized ? "Project: initialized." : uninitialized];
  if (isInitializing(root)) lines.push("Debt [init]: the init station started and never finished. Finish it with the init skill.");
  if (debts.length === 0) lines.push("Rails: clean. Ready for new work.");
  for (const debt of debts) lines.push(debt.kind === "paused" ? `Paused: ${debt.detail}` : `Debt [${debt.kind}]: ${debt.detail}`);
  for (const change of ledger.changes.filter((entry) => entry.status === "open")) {
    const staged = stageLine(change);
    if (staged) lines.push(staged);
  }
  if (ledger.ideas.length > 0) lines.push(`Backlog: ${ledger.ideas.length} idea(s) parked for later.`);
  const agents = runningAgents(root);
  if (agents.length > 0) lines.push(`Agents: ${describeAgents(agents)}.`);

  // Test runs repeated in the last day, and slow tests: one line, so the next plan of test runs starts from it
  const lately = readRuns(root).filter((run) => Date.now() - Date.parse(run.at) < RECENT_TESTS_MS);
  const testing = statusLine(summarize(lately, slowThreshold(root)));
  if (testing) lines.push(testing);

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

  return { code: 0, lines, data: { onRails: true, initialized, ...(adoptable ? { adoptable } : {}), debts, changes: ledger.changes, ideas: ledger.ideas, agents, elsewhere } };
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
 * Mark the current station done. `--design <slug>` records the design the change follows; from then on
 * `build` and `e2e` are done only when the design check of that design passed, or the person waived it.
 *
 * @param {Args} args positional: station; flags: --change, --design, --no-design-check
 * @returns {Result}
 * @example
 * done({ root, positional: ["design"], flags: { design: "tic-tac-toe-board" } });
 * done({ root, positional: ["build"], flags: {} }); // code 2 while the design check says FAIL
 */
export function done({ root, positional, flags }) {
  const [station] = positional;
  if (!station) return usage('moku-rails done <station> [--change <id>] [--design <slug>] [--no-design-check "<the person\'s words>"]');

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));
  if (change.station !== station) return refused(`Change ${change.id} is not inside "${station}" (it is ${change.station ? `inside "${change.station}"` : "between stations"}). Enter the station before finishing it.`);

  // The design this change follows, named by the station that captured it or grounded the plan in it
  if (flags.design !== undefined) {
    const slug = optional(flags.design);
    if (!slug || !DESIGN_SLUG.test(slug)) return usage("moku-rails done <station> --design <slug> (the folder name under .planning/design/)");
    if (!existsSync(resolve(root, ".planning", "design", slug, "design-context.md"))) return refused(`No design context at .planning/design/${slug}/design-context.md. Capture the design first, or name the right slug.`);
    change.design = slug;
  }

  // A change with a design leaves build and e2e only when the build matches the prototype
  if (flags["no-design-check"] === undefined) {
    const verdict = canFinish(change, station, designCheckVerdict(root, change.design));
    if (!verdict.ok) return { code: REFUSED, lines: [`Refused: ${verdict.reason}`, `Next step: ${verdict.missing}`], data: verdict };
  } else {
    const reason = optional(flags["no-design-check"]);
    if (!reason) return usage('moku-rails done <station> --no-design-check "<the person\'s words>"');
    change.note = `${change.note ? `${change.note} ` : ""}[${station} without design check: ${reason}]`;
  }

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
 * The Bash hook writes the same record after a commit whose pre-commit hook ran the whole test script
 * (commit-hook.mjs): that commit is the green run. No other run from a shell confirms anything here.
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

  // Slow tests are offered to the person here, as a follow-up; the close itself never waits for them
  const offer = slowOffer(summarize(readRuns(root), slowThreshold(root)));

  return { code: 0, lines: [`Closed ${change.id}.`, ...(offer ? [offer] : [])] };
}

/**
 * The test runs of this checkout as numbers: how many ran and who ran them, how many repeated a run on
 * an unchanged tree and what that cost, what the commit hook proves, and the slow tests. Read-only.
 *
 * @param {Args} args
 * @returns {Result} one fact per line; `data` holds the same as numbers, with the hook under `hook`
 * @example
 * tests({ root, positional: [], flags: {} }); // lines: ["Test runs: 14 since 2026-10-09 (…), 312 s in tests.", "Redundant: none.", …]
 */
export function tests({ root }) {
  if (!isOnRails(root)) return offRails();

  const report = summarize(readRuns(root), slowThreshold(root));
  const hook = commitHook(root);

  return { code: 0, lines: reportLines(report, hook), data: { ...report, hook: hook ?? null } };
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
  if (agents.length > 0) lines.push(`Warning: ${describeAgents(agents)} inside the station (started ${agents[0].startedAt}). The pause does not stop them and does not close their gate; take their reports when they arrive. A record left by an agent that crashed is dropped when this session's turn ends.`);

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
 * Adopt. Without an id: put an existing moku project on the rails in this checkout, writing the local
 * `.planning/` from what the repository shows, and nothing outside it. With an id: move a change from
 * another worktree into this checkout, because that worktree was removed or the work is handed over.
 *
 * @param {Args} args positional: [id]; flags: --type framework|consumer|tools|game, when the signs mislead
 * @returns {Result}
 * @example
 * adopt({ root, positional: [], flags: {} }); // a fresh clone of a game: "Adopted a-memory-missing (game) …"
 * adopt({ root, positional: ["2026-09-26-streak-midnight"], flags: {} });
 */
export function adopt({ root, positional, flags }) {
  const [id] = positional;
  if (!id) return adoptExisting(root, optional(flags.type));
  if (!isOnRails(root)) return offRails();

  const change = adoptChange(root, id);
  if (!change) return refused(`No other checkout holds a change "${id}". \`moku-rails status\` lists them under "Elsewhere".`);

  return ok(`Adopted ${id} into this checkout${change.station ? `, inside "${change.station}"` : ""}. Done so far: ${change.done.join(", ") || "nothing"}.`);
}

/**
 * Adopt the project in `root`. Refused where there is no moku code, which is the init station's ground,
 * and while init is scaffolding, which only init itself finishes.
 *
 * @param {string} root
 * @param {string | undefined} type the type a person set, over the one the signs show
 * @returns {Result}
 */
function adoptExisting(root, type) {
  if (type && !PROJECT_TYPES.has(type)) return usage("moku-rails adopt [--type framework|consumer|tools|game]");
  if (isInitializing(root)) return refused("the init station started here and never finished. Finish it with the init skill; adopt is for a project that init already built.");

  const seen = detectProject(root);
  if (!seen && !isInitialized(root) && !type) return { code: REFUSED, lines: ["Refused: no moku code here: no package.json that names a @moku-labs package. There is nothing to adopt.", "Next step: init (the `moku:init` skill scaffolds a new project)."], data: { ok: false, missing: "init" } };

  const actual = seen ?? { type: "tools", name: root.split("/").at(-1) ?? "project", coreVersion: "", created: new Date().toISOString().slice(0, 10), packages: {}, plugins: [] };
  const { created, kept } = adoptProject(root, { ...actual, type: /** @type {import("./adopt.mjs").ProjectType} */ (type ?? actual.type) });

  const shown = projectType(root);
  const lines = [created.length > 0 ? `Adopted ${actual.name} (${shown}): wrote .planning/${created.join(", .planning/")}${kept.length > 0 ? `, kept .planning/${kept.join(", .planning/")}` : ""}. No file outside .planning/ was touched.` : `Already adopted: .planning/${kept.join(" and .planning/")} exist, nothing changed.`];
  if (type && kept.includes("moku.md") && type !== shown) lines.push(`The marker already says type: ${shown}; it was kept. Edit .planning/moku.md to change it.`);
  if (!planningIgnored(root)) lines.push("Warning: git does not ignore .planning/ here. It is local state: add `.planning` to .gitignore so it is never committed.");
  lines.push("Next step: open the first change (the conductor does it).");
  const offer = offerOnce(root, RAILS_BIN, userSettingsFile());
  lines.push(...offer.lines);

  return { code: 0, lines, data: { ok: true, created, kept, type: shown, seen: seen ?? null, planningAccess: offer.data } };
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
 * In a game the root wiring, the doors and the state sit outside `src/`, so the project type is one of the facts.
 *
 * @param {Args} args positional: project-relative files; flags: --misses <n>
 * @returns {Result} one line: `fast`, or `deep: <reasons>`
 * @example
 * tier({ root, positional: ["src/plugins/hud/view.ts"], flags: {} }); // lines: ["fast"]
 * tier({ root: gameRoot, positional: ["game.ts"], flags: {} }); // lines: ["deep: game.ts: it is the game's root wiring"]
 */
export function tier({ root, positional, flags }) {
  const misses = Number(optional(flags.misses) ?? 0);
  const game = projectType(root) === "game";

  // A game's sensitive paths are anchored at the project root: "./game.ts" must read as "game.ts"
  const paths = game ? positional.map((path) => relative(root, resolve(root, path))) : positional;
  const verdict = tweakTier(paths, { exists: (path) => existsSync(resolve(root, path)), misses: Number.isFinite(misses) ? misses : 0, game });

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

  const offer = offerOnce(root, RAILS_BIN, userSettingsFile());

  return { code: 0, lines: [`${created ? "Session started" : "Session already active"} in ${root}. The rails and their hooks act here from now on.`, ...report.lines, ...offer.lines], data: { ...report.data, planningAccess: offer.data } };
}

/**
 * Keep the progress of every open session on this machine, so each one continues after the person signs in again.
 * Writes `~/.claude/moku-checkpoints/<time>.json`: per session its id, the app's local id, title and parent, folder,
 * repository and branch, uncommitted files, the open change with where it stopped, the background tasks that had not
 * reported back, and local copies of the artifacts it published, in `<time>/artifacts/<session>/`. The sessions are
 * the desktop app's open sessions of the current account (also those whose worktree was removed, while its branch
 * exists), plus terminal sessions on the rails of the last 48 hours. A run that finds everything as the newest
 * checkpoint has it writes no second file. The sign-in is the person's, through Claude Code's own commands: nothing
 * here reads or writes a credential.
 *
 * @param {Args} args flags: --since <hours>, --config-dir <dir>, --include-temp, --account <uuid>, --org <uuid>
 * @returns {Result}
 * @example
 * checkpoint({ root, positional: [], flags: { since: "8" } });
 */
export function checkpoint({ root, flags }) {
  const config = typeof flags["config-dir"] === "string" ? flags["config-dir"] : configDir();
  const hours = Number(flags.since ?? DEFAULT_SINCE_HOURS);
  if (!(hours > 0)) return usage(COMMAND_USAGE.checkpoint);

  const savedAt = new Date().toISOString();
  const desktopDir = currentAccountDir(desktopRoot(), { account: optional(flags.account), org: optional(flags.org) });
  let found;
  try {
    found = collectSessions({ config, sinceMs: hours * 60 * 60 * 1000, includeTemp: flags["include-temp"] === true, here: root, desktopDir, artifactsDir: join(checkpointFolder(savedAt), "artifacts") });
  } catch (error) {
    // A sandbox that may not read the config folder: say so, and where the command works instead
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    if (code !== "EPERM" && code !== "EACCES") throw error;
    return fail(`Could not read the transcripts in ${config}/projects (${code}): nothing was saved. Run \`moku-rails checkpoint\` where that folder is readable, such as a terminal outside the sandbox.`);
  }
  const { sessions, skipped } = found;
  if (sessions.length === 0) return ok(`No open session in ${config}${desktopDir ? " or in the desktop app" : ""}, and no moku session active in the last ${hours} h. Nothing to save.`);

  /** @type {import("./checkpoint.mjs").Checkpoint} */
  const saved = { version: 2, savedAt, configDir: config, desktopDir: desktopDir ?? null, sessions, skipped };
  const artifacts = sessions.reduce((count, session) => count + session.artifacts.length, 0);
  const summary = [
    ...sessions.flatMap((session) => [`- ${describeSession(session)}`, ...sessionNotes(session)]),
    ...skipped.slice(0, 5).map((entry) => `Not kept: "${entry.title}" ${entry.id.slice(0, 8)}: ${entry.reason}.`),
    ...(skipped.length > 5 ? [`Not kept: ${skipped.length - 5} more (--json lists them).`] : []),
  ];
  const steps = [
    "Next steps:",
    "1. Close these sessions, so none keeps running under the old sign-in. Uncommitted files stay on disk.",
    "2. Sign in with Claude Code's own command, in the same config folder so the transcripts stay visible: `claude auth login` (`--console` for an API key), or in the desktop app.",
    "3. Say \"restore the sessions\" in a new session: `moku-rails resume-checkpoint` brings them back.",
  ];

  // The same sessions in the same state as the newest checkpoint: that file stands, and the copies made now go
  const previousFile = latestCheckpoint();
  const previous = previousFile ? readCheckpoint(previousFile) : undefined;
  if (previousFile && previous && sameCheckpoint(previous, saved)) {
    const fresh = checkpointFolder(savedAt);
    if (fresh !== previousFile.replace(/\.json$/, "")) rmSync(fresh, { recursive: true, force: true });
    return { code: 0, lines: [`Nothing changed since the checkpoint ${previousFile}: no second file written. It keeps ${sessions.length} session${sessions.length === 1 ? "" : "s"}:`, ...summary, ...steps], data: { file: previousFile, unchanged: true, sessions, skipped } };
  }

  const file = writeCheckpoint(saved);
  const lines = [
    `Saved ${sessions.length} session${sessions.length === 1 ? "" : "s"} to ${file}:`,
    ...summary,
    ...(artifacts > 0 ? [`Kept local copies of ${artifacts} artifact${artifacts === 1 ? "" : "s"} in ${join(checkpointFolder(savedAt), "artifacts")}.`] : []),
    ...steps,
  ];

  return { code: 0, lines, data: { file, unchanged: false, sessions, skipped } };
}

/**
 * Turn a checkpoint, the newest unless a file is named, back into the steps that continue each session under the
 * current sign-in: the command, the new local id, the title to set again, and one message per session whose id or
 * whose side sessions' ids changed. Three steps act outside moku: `--open` is the person's, in a terminal with the
 * app open; it adds gone worktrees again, frees branches, opens every Code tab session (parents first, so the app
 * nests the side sessions itself) and prints the rest in the same run. `--carry` copies uncommitted files to the
 * folder the app opened a session in. `--relink` writes the parents and titles back into the app's records, with the
 * app closed and a backup first, only for what the app did not nest itself.
 *
 * @param {Args} args positional: [file]; flags: --config-dir <dir>, --desktop, --cli, --open, --carry, --relink
 * @returns {Result}
 * @example
 * resumeCheckpoint({ root, positional: [], flags: {} });
 */
export function resumeCheckpoint({ positional, flags }) {
  const config = typeof flags["config-dir"] === "string" ? flags["config-dir"] : configDir();
  const named = positional[0] ?? [flags.open, flags.relink, flags.carry].find((value) => typeof value === "string");
  const file = named ?? latestCheckpoint();
  const saved = file ? readCheckpoint(file) : undefined;
  if (!file || !saved) return refused(file ? `${file} is not a moku checkpoint.` : `there is no checkpoint in ${checkpointsDir()}. Run \`moku-rails checkpoint\` first.`);

  if (flags.open) return openSessions(saved, file);
  if (flags.relink) return relink(saved, file);
  if (flags.carry) return carry(saved);

  const surface = flags.desktop ? "desktop" : flags.cli ? "cli" : undefined;
  const reopened = reopenedSessions(saved);
  const sessions = reopened.map(({ session, newId, opened }) => ({ ...session, newId, opened, command: resumeCommand(session, surface), drift: driftNotes(session, config) }));
  const lines = [`Checkpoint of ${saved.savedAt}, ${sessions.length} session${sessions.length === 1 ? "" : "s"}. Continue each with:`];
  for (const session of sessions) {
    const artifacts = session.artifacts.map((artifact) => `  artifact: ${artifact.title || artifact.url} ${artifact.url} → ${artifactWhere(artifact)}`);
    const folder = session.folderGone && !existsSync(session.cwd) ? [`  folder gone: \`--open\` adds it again from ${session.branch} before it opens the session`] : [];
    lines.push(`- ${describeSession(session)}`, `  ${session.command}`, ...whereNow(session), ...folder, ...sessionNotes(session), ...artifacts, ...session.drift.map((note) => `  note: ${note}`));
  }
  if (config !== saved.configDir) lines.push(`The checkpoint was saved from ${saved.configDir} and Claude Code reads ${config} now: a session resumes only from the config folder that holds its transcript.`);

  const actions = resumeActions(reopened);
  const waiting = reopened.filter((entry) => entry.newId && !entry.opened).length;
  if (waiting > 0) lines.push(`${waiting} Code tab session${waiting === 1 ? " is" : "s are"} not open in the app yet. The person opens them with the app open, in its own terminal or any other: \`${RAILS_BIN} resume-checkpoint --open\`. It adds gone worktrees again, opens the sessions parents first and prints the titles and messages left to do, so this command need not run again.`);
  lines.push(...actionLines(actions, file));
  lines.push("Each session continues with its conversation; background tasks and the prompt cache do not carry over.");

  return { code: 0, lines, data: { file, savedAt: saved.savedAt, configDir: saved.configDir, sessions, idMap: Object.fromEntries(idMap(reopened)), ...actions, skipped: saved.skipped ?? [] } };
}

/**
 * Where a saved Code tab session is under the new sign-in, in one line: open or not, and its id, with the old one
 * only when it changed.
 *
 * @param {{ newId: string | null, opened: boolean, localId: string | null }} session
 * @returns {string[]}
 */
function whereNow(session) {
  if (!session.newId) return [];

  const id = session.localId && session.localId !== session.newId ? `${session.newId} (was ${session.localId})` : `${session.newId} (same id)`;
  return [`  ${session.opened ? "open in the app as" : "not open in the app yet, will be"} ${id}`];
}

/**
 * @typedef {object} ResumeActions
 * @property {{ sessionId: string, title: string }[]} titles the titles the app changed, to set again
 * @property {{ to: string, title: string, text: string }[]} messages one per open session whose id or side sessions' ids changed
 * @property {{ sessionId: string, title: string, from: string, files: number }[]} carry sessions the app may open in a new
 *   worktree, with uncommitted files in the old one
 * @property {{ nested: string[], unnested: { sessionId: string, title: string, parent: string }[] }} nesting side
 *   sessions the app nested under their parent itself, and those it did not
 * @property {{ sessionId: string, title: string, saved: string, now: string }[]} modes sessions the app opened in
 *   another permission mode than they ran in
 */

/**
 * What is left after the sessions are open: the titles to set, the messages to send, the files to carry, and the
 * side sessions the app did not nest.
 *
 * @param {import("./checkpoint.mjs").Reopened[]} reopened
 * @returns {ResumeActions}
 */
function resumeActions(reopened) {
  const map = idMap(reopened);
  const opened = reopened.filter((entry) => entry.opened && entry.newId);

  // A worktree the app made: it checks the branch out in a new one, and the files not committed stay behind
  const carryList = [];
  const notes = new Map();
  for (const entry of opened) {
    if (!entry.session.worktreeByApp || !existsSync(entry.session.cwd)) continue;
    const left = changedFiles(entry.session.cwd).length;
    if (left === 0) continue;
    carryList.push({ sessionId: /** @type {string} */ (entry.newId), title: entry.session.title, from: entry.session.cwd, files: left });
    notes.set(entry.newId, [`The app may open you in a new worktree of ${entry.session.branch}. Your ${left} uncommitted file${left === 1 ? "" : "s"} stay in ${entry.session.cwd}: if your folder is another one, run \`${RAILS_BIN} resume-checkpoint --carry\` first. It copies them over and overwrites nothing that changed.`]);
  }

  const titles = opened.filter((entry) => entry.session.title && entry.record?.title !== entry.session.title).map((entry) => ({ sessionId: /** @type {string} */ (entry.newId), title: entry.session.title }));
  const messages = resumeMessages(reopened, notes).filter((message) => opened.some((entry) => entry.newId === message.to));

  const nested = [];
  const unnested = [];
  for (const entry of opened) {
    const parent = entry.session.parent ? map.get(entry.session.parent) : undefined;
    if (!parent || !opened.some((other) => other.newId === parent)) continue;
    if (entry.record?.spawnedFrom?.sessionId === parent) nested.push(/** @type {string} */ (entry.newId));
    else unnested.push({ sessionId: /** @type {string} */ (entry.newId), title: entry.session.title, parent });
  }

  const modes = opened
    .filter((entry) => entry.session.permissionMode && entry.record && entry.record.permissionMode !== entry.session.permissionMode)
    .map((entry) => ({ sessionId: /** @type {string} */ (entry.newId), title: entry.session.title, saved: /** @type {string} */ (entry.session.permissionMode), now: entry.record?.permissionMode ?? "default" }));

  return { titles, messages, carry: carryList, nesting: { nested, unnested }, modes };
}

/**
 * The lines that tell the session running the resume what is left, so it acts on one run.
 *
 * @param {ResumeActions} actions
 * @param {string} file the checkpoint
 * @returns {string[]}
 */
function actionLines(actions, file) {
  const lines = [];
  if (actions.titles.length > 0) lines.push("Set these titles again with set_session_title (the app renamed them):", ...actions.titles.map((entry) => `  set_session_title ${entry.sessionId} ${JSON.stringify(entry.title)}`));
  if (actions.messages.length > 0) lines.push(`Send each of these ${actions.messages.length} session${actions.messages.length === 1 ? "" : "s"} its message with send_message (the full text is in --json, data.messages): ${actions.messages.map((message) => `${message.to} "${message.title}"`).join(", ")}.`);
  if (actions.carry.length > 0) lines.push(`After the messages, run \`${RAILS_BIN} resume-checkpoint --carry\`: ${actions.carry.map((entry) => `"${entry.title}" has ${entry.files} uncommitted file${entry.files === 1 ? "" : "s"} in ${entry.from}`).join("; ")}. It copies them to the folder the app opened the session in.`);
  if (actions.nesting.nested.length > 0) lines.push(`The app nested ${actions.nesting.nested.length} side session${actions.nesting.nested.length === 1 ? "" : "s"} under ${actions.nesting.nested.length === 1 ? "its parent" : "their parents"} itself.`);
  const { unnested } = actions.nesting;
  if (actions.modes.length > 0) lines.push(`${actions.modes.length} session${actions.modes.length === 1 ? "" : "s"} opened in another permission mode than ${actions.modes.length === 1 ? "it" : "they"} ran in: ${actions.modes.map((entry) => `"${entry.title}" ${entry.now} → ${entry.saved}`).join(", ")}. The person sets it back in each session's mode menu, or the Terminal.app line below writes it into the app's records.`);
  if (unnested.length > 0) lines.push(`${unnested.length} side session${unnested.length === 1 ? " is" : "s are"} not nested under ${unnested.length === 1 ? "its parent" : "their parents"}: ${unnested.map((entry) => `"${entry.title}"`).join(", ")}. Only the app's records bring it back, written while the app is closed.`);
  if (unnested.length > 0 || actions.modes.length > 0) {
    lines.push(`The person runs this one line in Terminal.app, not in the app's terminal, which closes with the app: it quits Claude, writes ${[unnested.length > 0 ? "the parents" : "", actions.modes.length > 0 ? "the permission modes" : ""].filter(Boolean).join(" and ")} after a backup, and opens Claude again:`, `  ${relinkLine(file)}`);
  }

  return lines;
}

/**
 * The one line for Terminal.app that quits the app, relinks and opens it again.
 *
 * @param {string} file the checkpoint
 * @returns {string}
 */
function relinkLine(file) {
  return `osascript -e 'quit app "Claude"'; while pgrep -xq Claude; do sleep 1; done; ${shellQuote(RAILS_BIN)} resume-checkpoint --relink ${shellQuote(file)}; open -a Claude`;
}

/**
 * Open every saved Code tab session in the desktop app that is not open there yet, parents before the sessions they
 * started, after giving each its folder back. Then, in the same run, everything that is left: the titles, the
 * messages, the files to carry and the nesting, also kept in `<checkpoint>/resume-actions.json`. The person's step,
 * with the app open and signed in.
 *
 * @param {import("./checkpoint.mjs").Checkpoint} saved
 * @param {string} file the checkpoint
 * @returns {Result}
 */
function openSessions(saved, file) {
  if (process.env.CLAUDECODE) return refused(`\`--open\` is the person's step: they run \`${RAILS_BIN} resume-checkpoint --open\` with the desktop app open, in its terminal or any other.`);

  const todo = parentsFirst(reopenedSessions(saved).filter((entry) => entry.newId && !entry.opened));
  const lines = [];
  const failed = [];
  for (const entry of todo) {
    const { session } = entry;
    const folder = prepareFolder({ cwd: session.cwd, repo: session.repo, branch: session.branch, releaseBranch: session.worktreeByApp === true });
    if (folder.line) lines.push(folder.line);
    if (folder.state === "lost" || folder.state === "blocked") {
      failed.push({ session, why: folder.state });
      continue;
    }
    if (!openInDesktop(session.cwd, session.id, session.permissionMode ?? null)) failed.push({ session, why: "open" });
  }

  const reopened = reopenedSessions(saved);
  const actions = resumeActions(reopened);
  const open = reopened.filter((entry) => entry.newId && entry.opened).length;
  const total = reopened.filter((entry) => entry.newId).length;
  const head = todo.length === 0 ? `Every Code tab session of the checkpoint is open in the app already (${open}).` : `Opened ${todo.length - failed.length} of ${todo.length} session${todo.length === 1 ? "" : "s"} in the app; ${open} of ${total} are open there now.`;
  for (const { session, why } of failed) lines.push(why === "lost" ? `Not opened, lost: ${describeSession(session)}.` : `Did not open: ${describeSession(session)}. Run \`${resumeCommand(session, "desktop")}\` in a terminal.`);
  for (const entry of reopened.filter((item) => item.opened && item.newId)) lines.push(`- ${entry.session.title || entry.session.id.slice(0, 8)}: ${entry.newId}${entry.session.localId && entry.session.localId !== entry.newId ? ` (was ${entry.session.localId})` : ""}`);

  const actionsFile = join(checkpointFolder(saved.savedAt), "resume-actions.json");
  mkdirSync(checkpointFolder(saved.savedAt), { recursive: true });
  writeFileSync(actionsFile, `${JSON.stringify({ checkpoint: file, ...actions }, null, 2)}\n`);
  const next = actionLines(actions, file);
  const pending = actions.titles.length + actions.messages.length + actions.carry.length + actions.nesting.unnested.length + actions.modes.length;

  return {
    code: failed.length > 0 ? 1 : 0,
    lines: [head, ...lines, ...(pending > 0 ? [`For the session that runs the resume (the same list is in ${actionsFile}):`, ...next] : [...next, "Nothing else to do: every title and permission mode is as it was, no id changed, and the side sessions are nested."])],
    data: { opened: todo.length - failed.length, failed: failed.map((entry) => entry.session.id), actionsFile, ...actions },
  };
}

/**
 * Copy the files each reopened session had not committed from its old folder to the one the app opened it in, when
 * the app moved it. Nothing is deleted, and a file that changed in the new folder is left as it is.
 *
 * @param {import("./checkpoint.mjs").Checkpoint} saved
 * @returns {Result}
 */
function carry(saved) {
  const lines = [];
  const moved = [];
  for (const entry of reopenedSessions(saved)) {
    const now = entry.record?.cwd;
    if (!entry.opened || !now || !existsSync(now) || samePath(now, entry.session.cwd)) continue;

    const { copied, kept } = carryFiles(entry.session.cwd, now);
    moved.push({ sessionId: entry.newId, from: entry.session.cwd, to: now, copied, kept });
    lines.push(`"${entry.session.title || entry.session.id.slice(0, 8)}" works in ${now} now: copied ${copied.length} uncommitted file${copied.length === 1 ? "" : "s"} from ${entry.session.cwd}${kept.length > 0 ? `; left ${kept.length} that changed there already: ${kept.join(", ")}` : ""}. The old folder keeps its copy.`);
  }

  return { code: 0, lines: lines.length > 0 ? lines : ["Every reopened session works in its saved folder: nothing to carry."], data: { moved } };
}

/**
 * Write the parents and titles of the saved sessions into the app's records of the reopened ones. The person's step,
 * from Terminal.app, with the app closed: the app writes its records back from memory while it runs.
 *
 * @param {import("./checkpoint.mjs").Checkpoint} saved
 * @param {string} file the checkpoint
 * @returns {Result}
 */
function relink(saved, file) {
  const line = relinkLine(file);
  if (process.env.CLAUDECODE) return refused(`\`--relink\` is the person's step, with the app closed. They run this line in Terminal.app, not in the app's terminal, which closes with the app: ${line}`);
  if (desktopAppRunning()) return refused(`the desktop app is running, and it writes its session records back from memory. Run this line in Terminal.app instead (not in the app's terminal): it quits Claude, relinks and opens it again: ${line}`);

  const reopened = reopenedSessions(saved);
  const ready = reopened.filter((entry) => entry.opened && entry.file).map((entry) => ({ ...entry.session, localId: /** @type {string} */ (entry.session.localId), file: /** @type {string} */ (entry.file) }));
  if (ready.length === 0) return refused(`no session of the checkpoint is open in the app under the new sign-in yet. Run \`${RAILS_BIN} resume-checkpoint --open\` first, with the app open.`);

  const backup = join(checkpointFolder(saved.savedAt), "desktop-backup", new Date().toISOString().replace(/[:.]/g, "-"));
  // A parent the app does not have yet is no parent to point at
  const { linked, titled, moded } = relinkSessions(ready, idMap(reopened.filter((entry) => entry.opened)), backup);
  const missing = reopened.filter((entry) => entry.newId && !entry.opened).length;

  return {
    code: 0,
    lines: [
      linked.length + titled.length + moded.length > 0 ? `Wrote the parent of ${linked.length}, the title of ${titled.length} and the permission mode of ${moded.length} session${moded.length === 1 ? "" : "s"} into the app's records. The records as they were are in ${backup}.` : "Every reopened session already has its parent, its title and its permission mode: nothing written.",
      ...(missing > 0 ? [`${missing} session${missing === 1 ? " is" : "s are"} not open in the app yet, so ${missing === 1 ? "it was" : "they were"} left out.`] : []),
      "Open the app: the sessions nest under their parents again.",
    ],
    data: { linked, titled, moded, backup },
  };
}

/**
 * Where a saved session stopped, and the background tasks it leaves to start again.
 *
 * @param {import("./checkpoint.mjs").SavedSession} session
 * @returns {string[]}
 */
function sessionNotes(session) {
  const change = session.change ? `  ${session.change.id}${session.change.title && session.change.title !== session.change.id ? ` (${session.change.title})` : ""}: ${session.change.next}` : session.root ? "  no open change" : session.folderGone ? `  its worktree was removed; ${session.branch} is kept to add it again` : "  off the rails";

  return [change, ...session.unfinished.map((task) => `  restart: ${task.kind} "${task.description}" did not finish`)];
}

/**
 * @param {string} text
 * @returns {string}
 */
function shellQuote(text) {
  return `'${text.replace(/'/g, "'\\''")}'`;
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

  // The second entry is growth, not iteration: the moment to offer stages, once
  const signal = splitSignal(change);
  if (signal === "scope") change.splitOffered = new Date().toISOString();

  saveLedger(root, ledger);

  const said = replans ? `Scope of ${change.id} grew. It is back in front of the plan station: write a delta spec for the new part, then build.` : `Scope note kept for ${change.id}.`;

  return { code: 0, lines: [said, ...(signal === "scope" ? [splitOffer(change, signal)] : [])], data: { ok: true, offer: signal === "scope" } };
}

/**
 * The stages of the open change. With no argument it says where they stand. `set` takes the stages the plan
 * wrote in `.planning/changes/<id>/stages.md` and refuses a DoD that only says the gates pass. `done` closes
 * the current stage on a committed tree, with the evidence that its DoD check showed the item done.
 *
 * @param {Args} args positional: [set | done]; flags: --milestone (set), --evidence (done), --change
 * @returns {Result}
 * @example
 * stages({ root, positional: ["set"], flags: { milestone: "friends v1" } });
 * stages({ root, positional: ["done"], flags: { evidence: "test \"sinceStart allocates nothing\" passes; no .slice( in rules.ts" } });
 */
export function stages({ root, positional, flags }) {
  const [action] = positional;
  if (action !== undefined && action !== "set" && action !== "done") return usage("moku-rails stages [set --milestone <name> | done --evidence <what the DoD check showed>]");

  const ledger = loadLedger(root);
  const change = findChange(ledger, optional(flags.change));

  if (action === undefined) return { code: 0, lines: [stageLine(change) ?? `${change.id} is done in one go, with no stages.`], data: { stages: change.stages ?? null, milestone: change.milestone ?? null } };
  if (action === "set") return setStages(root, ledger, change, optional(flags.milestone));

  return finishStage(root, ledger, change, optional(flags.evidence));
}

/**
 * Put the open change into the stages its plan wrote, and name the milestone they lead to.
 *
 * @param {string} root
 * @param {import("./ledger.mjs").Ledger} ledger
 * @param {import("./ledger.mjs").Change} change
 * @param {string | undefined} milestone
 * @returns {Result}
 */
function setStages(root, ledger, change, milestone) {
  if (!milestone) return usage("moku-rails stages set --milestone <where the stages lead>");
  if (change.stages?.some((stage) => stage.done)) return refused(`${change.id} already finished stage 1 of its stages. Its stages are not set again; a new part goes through \`moku-rails scope\`.`);

  const text = stagesText(root, change.id);
  if (text === undefined) return refused(`No .planning/changes/${change.id}/${STAGES_FILE}. Write the stages there first: a \`| Stage | What works after it | DoD |\` table.`);

  const read = readStages(text);
  if (read.problems.length > 0) return { code: REFUSED, lines: ["Refused: the stages cannot be taken as written.", ...read.problems], data: { ok: false, problems: read.problems } };

  change.stages = read.stages;
  change.milestone = milestone;
  ledger.milestone = milestone;
  saveLedger(root, ledger);

  return { code: 0, lines: [`${change.id} goes in ${read.stages.length} stages toward "${milestone}".`, /** @type {string} */ (stageLine(change)), "Hand the builder this stage only. It is done when its DoD check shows the item done, not only when the tests are green."], data: { ok: true, stages: change.stages } };
}

/**
 * Close the current stage. The tree must be committed, so a cut-off run of the next stage loses nothing,
 * and the evidence must say what the DoD check showed, not only that the gates passed.
 *
 * @param {string} root
 * @param {import("./ledger.mjs").Ledger} ledger
 * @param {import("./ledger.mjs").Change} change
 * @param {string | undefined} evidence
 * @returns {Result}
 */
function finishStage(root, ledger, change, evidence) {
  const current = currentStage(change);
  if (!change.stages) return refused(`${change.id} has no stages. Set them with \`moku-rails stages set\`.`);
  if (!current) return refused(`All stages of ${change.id} are done already.`);
  if (!evidence) return usage("moku-rails stages done --evidence <what the DoD check showed>");
  if (weakDod(evidence)) return refused(`The evidence "${evidence}" only says the gates pass. Stage ${current.number}'s DoD is: ${current.stage.dod}. Run that check and say what it showed.`);

  const commit = cleanHead(root);
  if (!commit) return refused(`Stage ${current.number} has uncommitted work. Commit it first: a committed stage survives a cut-off run of the next one.`);

  current.stage.done = new Date().toISOString();
  current.stage.commit = commit;
  current.stage.evidence = evidence;

  // The last stage reaches the milestone
  const next = currentStage(change);
  if (!next && ledger.milestone === change.milestone) ledger.milestone = null;
  saveLedger(root, ledger);

  return { code: 0, lines: [`Stage ${current.number} of ${change.id} is done on ${commit.slice(0, 7)}.`, /** @type {string} */ (stageLine(change))], data: { ok: true, stage: current.number, next: next?.number ?? null } };
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
  const offer = offerOnce(root, RAILS_BIN, userSettingsFile());

  return { code: 0, lines: ["Init station done. The project is initialized.", ...offer.lines], data: { planningAccess: offer.data } };
}

/**
 * The project's `.planning/` in the person's user settings, so worktree sessions write into it without a
 * prompt each time. Without `--apply` it says where things stand and prints the line; `--apply` writes the
 * one folder into `permissions.additionalDirectories` and keeps the rest. Only the person runs `--apply`,
 * with `!` in the prompt: the Bash hook refuses it from the agent.
 *
 * @param {Args} args flags: --apply
 * @returns {Result}
 * @example
 * allowPlanning({ root, positional: [], flags: {} }); // "Not yet allowed: … ! /…/moku-rails allow-planning --apply --root /work/site"
 */
export function allowPlanning({ root, flags }) {
  const file = userSettingsFile();
  if (flags.apply) {
    const result = applyAccess(root, file);
    if (result.error) return fail(result.error);
    return ok(result.changed ? `Added ${result.dir} to permissions.additionalDirectories in ${result.file}. Worktree sessions write into it without asking from now on.` : `Already allowed: ${result.file} covers ${result.dir}. Nothing changed.`);
  }

  const access = planningAccess(root, file);
  const apply = applyCommand(RAILS_BIN, root);
  if (access.allowed) return { code: 0, lines: [`Allowed: ${access.file} covers ${access.dir}.`], data: access };

  return { code: 0, lines: [`Not yet allowed: ${access.dir} is not in permissions.additionalDirectories of ${access.file}.`, ...offerLines(access, apply).slice(1)], data: { ...access, command: apply } };
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

/** Most output the test script may print. Node's default of 1 MB killed a large suite, reported as a timeout. */
const TEST_MAX_BUFFER = 64 * 1024 * 1024;

/** The rails' test run, as the test-run log names it. */
const TEST_COMMAND = "node --run test";

/**
 * Run the project's `test` script. `node --run` needs no package manager, so the rails stay runtime-neutral.
 * The run goes to the test-run log with its duration, and its whole output is kept in a file, so a red
 * run is read there and not run a second time.
 *
 * @param {string} root
 * @returns {string | undefined} the refusal reason when the tests are red, otherwise undefined
 */
function runTests(root) {
  const tree = treeKey(root);
  const started = Date.now();
  const run = spawnSync(process.execPath, ["--run", "test"], { cwd: root, encoding: "utf8", timeout: TEST_TIMEOUT_MS, maxBuffer: TEST_MAX_BUFFER });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

  const kept = saveOutput(root, output);
  logRun(root, { tree, started, green: run.status === 0, output });
  if (run.status === 0) return undefined;

  const tail = output.trim().split("\n").slice(-15).join("\n");

  return `The test script is red (exit ${run.status ?? "timeout"}), so "tests" stays unconfirmed. Fix the tests, then run the check again. The whole output is in ${kept}.\n${tail}`;
}

/**
 * Write the rails' own test run to the log. The tree is kept only when it is still the one the run
 * started on, and a run on a tree that already had its answer is marked as a repeat.
 *
 * @param {string} root
 * @param {{ tree: string | undefined, started: number, green: boolean, output: string }} facts
 */
function logRun(root, { tree, started, green, output }) {
  const key = fullKey(root) ?? TEST_COMMAND;
  const earlier = earlierRun(readRuns(root), { command: TEST_COMMAND, key, scope: "full", exitKnown: true }, tree);
  const same = tree !== undefined && treeKey(root) === tree;

  appendRun(root, { at: new Date(started).toISOString(), command: TEST_COMMAND, key, scope: "full", ...(same ? { tree } : {}), ms: Date.now() - started, outcome: green ? "green" : "red", by: "rails", ...(earlier ? { repeats: earlier.outcome } : {}), ...readings(parseTestOutput(output)) });
}

/** @param {string | true | undefined} value */
function optional(value) {
  return typeof value === "string" ? value : undefined;
}

/** A design slug is a folder name, never a path. */
const DESIGN_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The verdict line of a design's check report, written by the design check of the `moku-design` pack.
 *
 * @param {string} root
 * @param {string | undefined} slug
 * @returns {"PASS" | "FAIL" | undefined} undefined when the change has no design, or the report has no verdict
 */
function designCheckVerdict(root, slug) {
  if (!slug) return undefined;

  const report = resolve(root, ".planning", "design", slug, "check", "design-check.md");
  if (!existsSync(report)) return undefined;

  const verdict = /^Verdict:\s*(PASS|FAIL)\b/m.exec(readFileSync(report, "utf8"));
  return verdict ? /** @type {"PASS" | "FAIL"} */ (verdict[1]) : undefined;
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
