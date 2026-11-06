/**
 * The design check at the end of a UI unit, read by the builder's stop hook: a builder that built a screen
 * from a design context runs `moku-fidelity check` before it reports, and this hook holds it to that.
 *
 * It reads only files the check wrote under `.planning/design/{slug}/`: `check/expected.json` (the fixed
 * inventory), `check/result.json` (the last comparison) and `deviations.json` (the questions for the person).
 * It never measures anything itself; the builder does, minutes earlier than the build station's Step 7.6.
 *
 * - No inventory captured: nothing to hold the builder to (the orchestrator captures it first).
 * - No result, a result older than the unit's files, a size not measured, or failing rows: block once.
 * - Open rows (borderline values, deviations waiting on the person): no block; the orchestrator is told to
 *   put the questions to the person now, before the next wave, instead of at the end of the build.
 * - The builder said it could not measure (`design.verdict: "unmeasured"`): the orchestrator measures in the
 *   browser pane now.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_ROWS = 12;

/**
 * @typedef {{ block?: string, message?: string, log: Record<string, unknown> }} DesignVerdict
 */

/**
 * @param {string} root project root
 * @param {{ design?: { slug?: unknown, unit?: unknown, verdict?: unknown }, files?: unknown, agent?: unknown }} contract the builder's report
 * @returns {DesignVerdict | undefined} undefined when the unit has no design to check
 */
export function designVerdict(root, contract) {
  const slug = typeof contract.design?.slug === "string" ? contract.design.slug : undefined;
  if (!slug || !/^[\w.-]+$/.test(slug)) return undefined;

  const dir = join(root, ".planning", "design", slug);
  const expected = readJson(join(dir, "check", "expected.json"));
  if (!expected?.complete) return { log: { slug, design: "not captured" } };

  const command = `moku-fidelity check .planning/design/${slug} --url <the running app> (or --serve <folder>)${contract.design?.unit ? ` --unit ${String(contract.design.unit)} --elements <your elements>` : ""}`;
  if (String(contract.design?.verdict ?? "").toLowerCase() === "unmeasured") {
    return { message: `moku: ${agentName(contract)} built a screen of design ${slug} but could not measure it here (no headless browser). Run the design check for it now in the browser pane (moku-fidelity probe / ingest, design-check.md), before the next wave.`, log: { slug, design: "unmeasured" } };
  }

  const unit = typeof contract.design?.unit === "string" && /^[\w.-]+$/.test(contract.design.unit) ? contract.design.unit : undefined;
  const result = readJson(unit ? join(dir, "check", "units", unit, "result.json") : join(dir, "check", "result.json"));
  if (!result?.summary) return { block: `Your unit builds a screen of design ${slug}, and the design check has not run. Run it now, as the last step before your report: ${command}. Fix what fails inside your unit, raise a deviation for what cannot follow the prototype, then deliver the report again with its \`design\` block.`, log: { slug, design: "no result" } };

  const newest = newestFile(root, contract.files);
  if (newest && Date.parse(result.at ?? "") < newest - 1000) return { block: `The design check of ${slug} is older than your last edit. Run it again: ${command}, then deliver the report again.`, log: { slug, design: "stale" } };

  const summary = result.summary;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const failing = rows.filter((row) => row.result === "fail" || row.result === "unmeasured");
  const missing = Array.isArray(summary.missingSizes) ? summary.missingSizes : [];
  if (failing.length > 0 || missing.length > 0) {
    const lines = [`The design check of ${slug} fails: ${summary.fail} failing and ${summary.unmeasured} unmeasured rows${missing.length ? `, sizes not measured: ${missing.join(", ")}` : ""}. Fix them inside your unit and run the check again. A row the project cannot follow (a face, an effect, a rule): raise it with \`moku-fidelity deviate\` and build the proposal, never a silent substitute.`];
    for (const row of failing.slice(0, MAX_ROWS)) lines.push(`  ${row.row}: expected ${row.expected}, actual ${row.actual}${row.note ? ` — ${row.note}` : ""}`);
    if (failing.length > MAX_ROWS) lines.push(`  … ${failing.length - MAX_ROWS} more in .planning/design/${slug}/check/design-check.md`);
    return { block: lines.join("\n"), log: { slug, design: "fail", fail: summary.fail, unmeasured: summary.unmeasured } };
  }

  const pending = readDeviations(join(dir, "deviations.json")).filter((entry) => !entry?.decision?.answer);
  if (summary.open > 0 || pending.length > 0) {
    const questions = pending.map((entry) => `${entry.id} ${entry.element}${entry.prop ? `·${entry.prop}` : ""}: ${entry.reason} → proposal: ${entry.proposal}`).join("; ");
    return { message: `moku: design ${slug} — ${summary.open} open row(s) and ${pending.length} deviation(s) waiting on the person. Ask the person now, before the next wave${questions ? `: ${questions}` : ""}. Record each answer with \`moku-fidelity decide\`. Report: .planning/design/${slug}/check/design-check.md`, log: { slug, design: "open", open: summary.open, pending: pending.length } };
  }

  return { log: { slug, design: summary.verdict === "PASS" ? "pass" : String(summary.verdict) } };
}

/**
 * The newest modification time among the unit's files, in ms.
 *
 * @param {string} root
 * @param {unknown} files
 * @returns {number | undefined}
 */
function newestFile(root, files) {
  let newest;
  for (const file of Array.isArray(files) ? files : []) {
    if (typeof file !== "string") continue;
    try {
      const time = statSync(join(root, file)).mtimeMs;
      newest = newest === undefined ? time : Math.max(newest, time);
    } catch {
      /* a deleted file */
    }
  }
  return newest;
}

/** @param {{ agent?: unknown }} contract */
function agentName(contract) {
  return typeof contract.agent === "string" ? contract.agent : "the builder";
}

/** @param {string} file */
function readDeviations(file) {
  const data = readJson(file);
  return Array.isArray(data) ? data : Array.isArray(data?.deviations) ? data.deviations : [];
}

/** @param {string} file */
function readJson(file) {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}
