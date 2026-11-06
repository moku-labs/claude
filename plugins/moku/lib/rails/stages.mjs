/**
 * Stages of a change: when to offer them, and what a stage must prove before the next one starts.
 *
 * Stages are never the default. Inside the model's horizon they cost 1.6–2× in money and time and raise
 * nothing; what they buy is a smaller context per builder and a run cut off at its turn limit that loses no
 * work. So they are offered on two signals seen while the work runs, never on the wording of a request:
 * the change grew a second time (`moku-rails scope`), or a builder was cut off: it stopped at its turn limit
 * or ended without its report.
 *
 * A staged change carries its stages, each with its own DoD, and the ledger's `milestone` names where the
 * stages lead. A DoD that only says "tests green" is refused: a stage once closed on green tests while its
 * item was not done, because no test watched the item.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadLedger, saveLedger, withLedger } from "./ledger.mjs";
import { tableRows } from "./waves.mjs";

/** @typedef {import("./ledger.mjs").Change} Change */
/** @typedef {{ title: string, dod: string, done?: string, commit?: string, evidence?: string }} Stage */

/** The scope entry that makes a change "grown": the first one is ordinary iteration, the second is growth. */
export const GROWTH_SCOPES = 2;

/** Agents whose cut-off run is a signal: the ones that write the change's code. */
export const EXECUTOR = /(^|:)moku-(builder|builder-deep|tweaker)$/;

/** Where the plan writes the stages of a change. */
export const STAGES_FILE = "stages.md";

/**
 * Words that say "the gates pass" and nothing about the item. A DoD made only of them is weak.
 * Short words (under three letters) never count either way.
 */
const GATE_WORDS = new Set([
  "all", "and", "the", "test", "tests", "unit", "suite", "suites", "green", "pass", "passes", "passing", "passed", "check", "checks",
  "lint", "linted", "tsc", "type", "types", "typecheck", "build", "builds", "clean", "bun", "npm", "run", "runs", "moku-rails",
  "are", "stay", "stays", "still", "errors", "error", "failures", "fail", "everything", "works", "work", "done", "with", "then",
  "after", "stage", "stages", "red", "none", "zero", "whole", "full", "project", "code", "oxlint", "biome", "vitest", "jest",
  "тесты", "тест", "зелёные", "зеленые", "зелёный", "зеленый", "проходят", "проходит", "все", "всё", "проверка", "проверки", "чек", "линт",
  "сборка", "этап", "после", "ошибок", "без", "чисто", "работает",
]);

/**
 * True when a DoD (or the evidence for one) proves only that the gates pass: tests, lint, types. Such a DoD
 * lets a stage close while its item is undone, when no test watches the item. A DoD that names the item and
 * a check of it (a test by name, a grep, a grader, a measured value) is not weak.
 *
 * @param {string} text
 * @returns {boolean}
 * @example
 * weakDod("bun test green, tsc clean"); // true
 * weakDod("test \"sinceStart allocates nothing\" passes; no `.slice(` in rules.ts"); // false
 */
export function weakDod(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_.-]*/gu) ?? [];
  const telling = words.filter((word) => word.length >= 3 && !GATE_WORDS.has(word) && !/^\d+$/.test(word));

  return telling.length < 2;
}

/**
 * Which signal, if any, makes this the moment to offer stages. Silent for a quick-edit change, for a change
 * already in stages, and once the offer was made: the person answers it once.
 *
 * @param {Change} change
 * @returns {"scope" | "cutoff" | null}
 * @example
 * splitSignal({ size: "M", scope: ["rebrand", "add sharing"] }); // "scope"
 * splitSignal({ size: "M", scope: ["rebrand"] }); // null
 */
export function splitSignal(change) {
  if (String(change.size) === "Q" || change.stages || change.splitOffered) return null;
  if ((change.scope?.length ?? 0) >= GROWTH_SCOPES) return "scope";
  if ((change.cutoffs ?? 0) > 0) return "cutoff";

  return null;
}

/**
 * The offer the conductor puts to the person, once, in their language. It names the signal and the price.
 *
 * @param {Change} change
 * @param {"scope" | "cutoff"} signal
 * @returns {string}
 */
export function splitOffer(change, signal) {
  const why = signal === "scope" ? `${change.id} has grown ${change.scope?.length} times since it opened` : `a builder of ${change.id} was cut off before it finished`;

  return [
    `Stages offer: ${why}. Offer the person, once and in two or three sentences, to finish it in stages: what is built becomes stage 1, the rest is planned as the next stages, each a working increment with its own check.`,
    "Say the price plainly: stages take about 1.6–2× the time and money, but each builder works with a smaller context, and a run that is cut off loses no work, because each stage is committed.",
    `It is their call: a no keeps one go and is not asked again. On a yes, write .planning/changes/${change.id}/${STAGES_FILE} (a \`| Stage | What works after it | DoD |\` table; each DoD names the check of the item itself, never only "tests green") and run \`moku-rails stages set --milestone "<where the stages lead>"\`.`,
  ].join(" ");
}

/**
 * Note that a builder of the open change was cut off: turn limit, or no report. Called by the SubagentStop hook.
 *
 * @param {string} root
 * @returns {boolean} true when an open change took the note
 */
export function recordCutoff(root) {
  return withLedger(root, () => {
    const ledger = loadLedger(root);
    const change = onlyOpen(ledger);
    if (!change) return false;

    change.cutoffs = (change.cutoffs ?? 0) + 1;
    saveLedger(root, ledger);

    return true;
  });
}

/**
 * The stages offer for the open change when a cut-off is waiting to be offered, marked as made so it comes
 * once. Read by the hooks that hand a builder's result to the conductor.
 *
 * @param {string} root
 * @returns {string | undefined}
 */
export function takeSplitOffer(root) {
  if (!existsSync(join(root, ".planning", "state.json"))) return undefined;

  return withLedger(root, () => {
    const ledger = loadLedger(root);
    const change = onlyOpen(ledger);
    const signal = change ? splitSignal(change) : null;
    if (!change || signal !== "cutoff") return undefined;

    change.splitOffered = new Date().toISOString();
    saveLedger(root, ledger);

    return `moku: ${splitOffer(change, signal)}`;
  });
}

/**
 * Read the stages a plan wrote: `| Stage | What works after it | DoD |`. `problems` names every stage the
 * rails will not accept: fewer than two stages, a stage with no title, a DoD that is missing or weak.
 *
 * @param {string} text the text of `stages.md`
 * @returns {{ stages: Stage[], problems: string[] }}
 * @example
 * readStages("| Stage | What works after it | DoD |\n|---|---|---|\n| 1 | W1 | test \"sinceStart allocates nothing\" passes |\n| 2 | W2 | test \"cameraOf returns the shared constant\" passes |").stages.length; // 2
 */
export function readStages(text) {
  const stages = tableRows(text, /^\|\s*Stage\s*\|/i).map(([, title, dod]) => ({ title: title ?? "", dod: dod ?? "" }));
  const problems = [];

  if (stages.length < 2) problems.push(`A split needs at least two stages; ${STAGES_FILE} has ${stages.length}. The table is \`| Stage | What works after it | DoD |\`.`);
  for (const [index, stage] of stages.entries()) {
    const name = `Stage ${index + 1}`;
    if (!stage.title) problems.push(`${name} has no title.`);
    if (!stage.dod) problems.push(`${name} has no DoD.`);
    else if (weakDod(stage.dod)) problems.push(`${name}'s DoD "${stage.dod}" only says the gates pass. Name the check of the item itself: a test by name that fails while the item is undone, a grep, a grader, a measured value.`);
  }

  return { stages, problems };
}

/**
 * The text of a change's stages file, or undefined when the plan wrote none.
 *
 * @param {string} root
 * @param {string} id change id
 * @returns {string | undefined}
 */
export function stagesText(root, id) {
  const file = join(root, ".planning", "changes", id, STAGES_FILE);

  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/**
 * The stage the change works on: the first one not done, with its number. Undefined when all are done.
 *
 * @param {Change} change
 * @returns {{ stage: Stage, number: number } | undefined}
 */
export function currentStage(change) {
  const index = (change.stages ?? []).findIndex((stage) => !stage.done);

  return index === -1 ? undefined : { stage: /** @type {Stage[]} */ (change.stages)[index], number: index + 1 };
}

/**
 * One line on where a staged change stands, for `status` and for the stage commands.
 *
 * @param {Change} change
 * @returns {string | undefined}
 */
export function stageLine(change) {
  if (!change.stages) return undefined;

  const total = change.stages.length;
  const current = currentStage(change);
  const toward = change.milestone ? ` toward "${change.milestone}"` : "";
  if (!current) return `Stages: all ${total} stages of ${change.id} are done${toward}. Go on to the next station.`;

  return `Stages: ${change.id} is at stage ${current.number} of ${total}${toward}: ${current.stage.title}. DoD: ${current.stage.dod}`;
}

/**
 * The one open change of this lane, or undefined when there is none or several.
 *
 * @param {import("./ledger.mjs").Ledger} ledger
 * @returns {Change | undefined}
 */
function onlyOpen(ledger) {
  const open = ledger.changes.filter((change) => change.status === "open");

  return open.length === 1 ? open[0] : undefined;
}
