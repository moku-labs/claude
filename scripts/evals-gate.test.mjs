import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { caseFilter, compare, report, summarize } from "./evals-gate.mjs";

const run = (passed, costUsd = 0.2, durationSeconds = 20) => ({ passed, score: passed ? 1 : 0, costUsd, durationSeconds, error: null });
const result = (cases) => ({
  cases: Object.entries(cases).map(([name, runs]) => ({
    name,
    arms: { with: runs },
    aggregates: { score: runs.filter((r) => r.passed).length / runs.length }
  }))
});
const baseline = summarize(result({ a: [run(true), run(true), run(true)], b: [run(true), run(true), run(false)], c: [run(true), run(true), run(true)] }));

describe("summarize", () => {
  it("counts passed runs and averages cost and time per run", () => {
    const summary = summarize(result({ a: [run(true, 0.1, 10), run(false, 0.3, 30), { ...run(true), error: "timeout" }] }));

    assert.deepEqual(summary.cases.a, { runs: 3, passed: 1, score: 2 / 3, costUsd: 0.2, durationSeconds: 20 });
  });
});

describe("compare", () => {
  it("passes the baseline against itself", () => {
    assert.equal(compare(baseline, baseline).failed, false);
  });

  it("lets a case lose exactly one run of three", () => {
    const current = summarize(result({ a: [run(true), run(true), run(false)], b: [run(true), run(true), run(false)], c: [run(true), run(true), run(true)] }));

    assert.equal(compare(baseline, current).failures.some((line) => line.startsWith("a:")), false);
  });

  it("fails a case that loses two runs of three", () => {
    const current = summarize(result({ a: [run(true), run(false), run(false)], b: [run(true), run(true), run(false)], c: [run(true), run(true), run(true)] }));
    const verdict = compare(baseline, current);

    assert.equal(verdict.failed, true);
    assert.match(verdict.failures.join("\n"), /^a: 1\/3 runs passed, baseline 3\/3$/m);
  });

  it("fails an overall score more than 0.03 below the baseline", () => {
    const soft = (passed) => ({ ...run(passed), score: 0.95 });
    const current = summarize(result({ a: [run(true), run(true), run(true)], b: [run(true), run(true), run(false)], c: [soft(true), soft(true), soft(true)] }));
    current.cases.a.score = 0.9;
    const verdict = compare(baseline, current);

    assert.match(verdict.failures.join("\n"), /overall score/);
  });

  it("fails a baseline case that did not run", () => {
    const current = summarize(result({ a: [run(true), run(true), run(true)], b: [run(true), run(true), run(false)] }));

    assert.match(compare(baseline, current).failures.join("\n"), /^c: missing/m);
  });

  it("judges a one-run result on the scale of three", () => {
    const current = summarize(result({ a: [run(false)], b: [run(true)], c: [run(true)] }));

    assert.match(compare(baseline, current).failures.join("\n"), /^a: 0\/1/m);
  });

  it("warns, without failing, on cost and time over +10 %", () => {
    const slow = run(true, 0.3, 40);
    const current = summarize(result({ a: [slow, slow, slow], b: [slow, slow, run(false, 0.3, 40)], c: [slow, slow, slow] }));
    const verdict = compare(baseline, current);

    assert.equal(verdict.failed, false);
    assert.equal(verdict.warnings.length, 2);
    assert.match(report(verdict, "test"), /cost 0\.9 is 50 % over the baseline 0\.6/);
  });

  it("judges only the filtered cases of a partial run", () => {
    const current = summarize(result({ a: [run(true), run(true), run(true)] }));

    assert.equal(compare(baseline, current, caseFilter("a")).failed, false);
    assert.equal(compare(baseline, current).failed, true);
  });
});

describe("caseFilter", () => {
  it("reads * and ? and nothing else as a wildcard", () => {
    const only = caseFilter("tests-*.?");

    assert.equal(only("tests-kill.x"), true);
    assert.equal(only("tests-killxx"), false);
    assert.equal(only("rails-no-init"), false);
  });
});
