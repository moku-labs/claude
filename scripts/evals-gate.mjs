/**
 * The eval gate: runs the core eval suite of plugins/moku and compares it with the committed baseline.
 *
 * It fails when the overall score drops more than 0.03 below the baseline, or when a case loses more than
 * one passing run in three. Cost and time are reported, with a warning above +10 %; they never fail it.
 *
 *   node scripts/evals-gate.mjs                      run the suite (about $11, 6–8 min) and compare
 *   node scripts/evals-gate.mjs --from <result.json> compare a result already on disk, no run
 *   node scripts/evals-gate.mjs --case 'tests-*'     run and compare only the matching cases
 *   node scripts/evals-gate.mjs --write-baseline <result.json>   replace the baseline from a result
 *
 * In CI without ANTHROPIC_API_KEY (a fork PR, or the secret is not set) it says so and exits 0.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const BASELINE = "plugins/moku/evals/baselines/gate.json";
export const SCORE_DROP = 0.03;
export const LOST_RUNS = 1;
export const SPEND_WARN = 0.1;

/**
 * Shrinks a full `claude plugin eval --json` result to what the gate compares, per case: runs, passed runs,
 * score, and the mean cost and time of one run.
 *
 * @param {any} result - The parsed result of `claude plugin eval --json`.
 * @returns {{ overallScore: number, costUsd: number, durationSeconds: number, cases: Record<string, any> }}
 */
export function summarize(result) {
  const cases = {};
  for (const item of result.cases) {
    const runs = item.arms?.with ?? [];
    const mean = (key) => (runs.length ? runs.reduce((sum, run) => sum + (run[key] ?? 0), 0) / runs.length : 0);
    cases[item.name] = {
      runs: runs.length,
      passed: runs.filter((run) => run.passed && !run.error).length,
      score: item.aggregates?.score ?? 0,
      costUsd: round(mean("costUsd"), 3),
      durationSeconds: round(mean("durationSeconds"), 1)
    };
  }
  return totals(cases);
}

/**
 * Compares a summarized run with the baseline. Only the cases of the baseline that `only` keeps are judged;
 * a baseline case missing from the run fails, a new case is listed and not judged.
 *
 * @param {ReturnType<typeof summarize>} baseline - The committed baseline.
 * @param {ReturnType<typeof summarize>} current - This run.
 * @param {(name: string) => boolean} [only] - The case filter of a partial run.
 * @returns {{ failed: boolean, failures: string[], warnings: string[], rows: any[], base: any, cur: any }}
 */
export function compare(baseline, current, only = () => true) {
  const failures = [];
  const warnings = [];
  const rows = [];
  const names = Object.keys(baseline.cases).filter(only);

  for (const name of names) {
    const was = baseline.cases[name];
    const now = current.cases[name];
    if (!now || now.runs === 0) {
      failures.push(`${name}: missing from this run`);
      rows.push({ name, was, now: null, lost: null });
      continue;
    }

    // Lost runs are counted on the scale of three, so a run with --runs 1 or 5 is judged the same way
    const lost = round(3 * (was.passed / was.runs - now.passed / now.runs), 2);
    if (lost > LOST_RUNS) failures.push(`${name}: ${now.passed}/${now.runs} runs passed, baseline ${was.passed}/${was.runs}`);
    rows.push({ name, was, now, lost });
  }

  for (const name of Object.keys(current.cases).filter((name) => only(name) && !baseline.cases[name])) {
    warnings.push(`${name}: new case, not in the baseline (not judged)`);
  }

  const base = totals(pick(baseline.cases, names));
  const cur = totals(pick(current.cases, names));
  if (cur.overallScore < base.overallScore - SCORE_DROP) {
    failures.push(`overall score ${fmt(cur.overallScore)} < baseline ${fmt(base.overallScore)} − ${SCORE_DROP}`);
  }
  for (const [key, label] of [["costUsd", "cost"], ["durationSeconds", "time"]]) {
    if (base[key] > 0 && cur[key] > base[key] * (1 + SPEND_WARN)) {
      warnings.push(`${label} ${fmt(cur[key])} is ${percent(cur[key], base[key])} over the baseline ${fmt(base[key])}`);
    }
  }

  return { failed: failures.length > 0, failures, warnings, rows, base, cur };
}

/**
 * Renders the verdict as Markdown for the terminal and the GitHub job summary.
 *
 * @param {ReturnType<typeof compare>} verdict - The comparison.
 * @param {string} source - Where the baseline came from.
 * @returns {string}
 */
export function report(verdict, source) {
  const { base, cur } = verdict;
  const lines = [
    `## Eval gate: ${verdict.failed ? "FAILED" : "passed"}`,
    "",
    `Baseline: ${source}. Fails below overall ${fmt(base.overallScore - SCORE_DROP)} or when a case loses more than ${LOST_RUNS} run of 3.`,
    "",
    "| | Score | Cost per run-set, $ | Time per run-set, s |",
    "|---|---|---|---|",
    `| baseline | ${fmt(base.overallScore)} | ${fmt(base.costUsd)} | ${Math.round(base.durationSeconds)} |`,
    `| this run | ${fmt(cur.overallScore)} | ${fmt(cur.costUsd)} (${signed(cur.costUsd, base.costUsd)}) | ${Math.round(cur.durationSeconds)} (${signed(cur.durationSeconds, base.durationSeconds)}) |`,
    "",
    "| Case | Passed runs | Score | $ / run | s / run |",
    "|---|---|---|---|---|"
  ];
  for (const { name, was, now, lost } of verdict.rows) {
    const mark = now === null || lost > LOST_RUNS ? " ✗" : "";
    lines.push(now === null
      ? `| ${name}${mark} | missing (was ${was.passed}/${was.runs}) | — | — | — |`
      : `| ${name}${mark} | ${now.passed}/${now.runs} (was ${was.passed}/${was.runs}) | ${fmt(now.score)} (${fmt(was.score)}) | ${fmt(now.costUsd)} | ${Math.round(now.durationSeconds)} |`);
  }
  if (verdict.failures.length) lines.push("", "**Failures**", ...verdict.failures.map((line) => `- ${line}`));
  if (verdict.warnings.length) lines.push("", "**Warnings**", ...verdict.warnings.map((line) => `- ⚠ ${line}`));
  return `${lines.join("\n")}\n`;
}

/**
 * A glob of `--case` as a predicate: `*` and `?` only, the way the runner reads it.
 *
 * @param {string | undefined} glob - The glob, or nothing for every case.
 * @returns {(name: string) => boolean}
 */
export function caseFilter(glob) {
  if (!glob) return () => true;
  const pattern = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return (name) => new RegExp(`^${pattern}$`).test(name);
}

function totals(cases) {
  const list = Object.values(cases);
  const sum = (key) => list.reduce((total, item) => total + item[key], 0);
  return {
    overallScore: round(list.length ? sum("score") / list.length : 0, 4),
    costUsd: round(sum("costUsd"), 2),
    durationSeconds: round(sum("durationSeconds"), 0),
    cases
  };
}

function pick(cases, names) {
  return Object.fromEntries(names.filter((name) => cases[name]).map((name) => [name, cases[name]]));
}

function round(value, digits) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function fmt(value) {
  return String(Number(value.toFixed(3)));
}

function percent(value, base) {
  return `${Math.round((value / base - 1) * 100)} %`;
}

function signed(value, base) {
  if (!base) return "—";
  const change = Math.round((value / base - 1) * 100);
  return `${change >= 0 ? "+" : ""}${change} %`;
}

/** Runs the suite the way the baseline was taken: this repo's moku-rails first, no installed plugin bins. */
function runSuite(glob, runs) {
  const out = join(mkdtempSync(join(tmpdir(), "evals-gate-")), "result.json");
  const path = (process.env.PATH ?? "").split(":").filter((dir) => !dir.includes("/.claude/plugins/cache/"));
  const args = [
    "plugin", "eval", "plugins/moku", "--scaffold", "--trust-plugin", "--no-publish",
    "--allow-tools", "Write", "Edit", "Bash",
    "--runs", String(runs), "--ablation", "none", "-j", process.env.EVALS_CONCURRENCY ?? "4",
    "--threshold", "0", "--max-cost-usd", process.env.EVALS_MAX_COST_USD ?? "20", "--json", out
  ];
  if (glob) args.push("--case", glob);
  console.error(`$ claude ${args.join(" ")}`);
  const child = spawnSync("claude", args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, PATH: [resolve("plugins/moku/bin"), ...path].join(":") }
  });
  if (child.error) throw child.error;
  // exit 1 is "a case below --threshold", which is 0 here; 2 is the cost ceiling, partial results stay usable
  if (child.status !== 0 && child.status !== 2) throw new Error(`claude plugin eval exited ${child.status}`);
  return out;
}

function main(argv) {
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const glob = option("--case");
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const say = (text) => {
    process.stdout.write(text);
    if (summary) appendFileSync(summary, text);
  };

  const target = option("--write-baseline");
  if (target) {
    const result = JSON.parse(readFileSync(target, "utf8"));
    const baseline = {
      source: option("--source") ?? `${result.suite?.plugins?.[0]?.name}@${result.suite?.plugins?.[0]?.version}, ${result.startedAt}`,
      ...summarize(result)
    };
    writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
    say(`wrote ${BASELINE}: overall ${baseline.overallScore}, $${baseline.costUsd}, ${baseline.durationSeconds} s, ${Object.keys(baseline.cases).length} cases\n`);
    return 0;
  }

  let from = option("--from");
  if (!from && process.env.CI && !process.env.ANTHROPIC_API_KEY) {
    say("## Eval gate: skipped\n\nNo `ANTHROPIC_API_KEY` secret in this run (a fork PR, or the secret is not set), so the evals did not run. Run `npm run evals:gate` locally before merging a change to the plugin's prose.\n");
    return 0;
  }
  from ??= runSuite(glob, Number(option("--runs") ?? 3));

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const verdict = compare(baseline, summarize(JSON.parse(readFileSync(from, "utf8"))), caseFilter(glob));
  say(report(verdict, baseline.source));
  console.error(`result: ${from}`);
  return verdict.failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
