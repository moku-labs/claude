import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { outcomeOf, parseTestOutput, readings } from "../../lib/rails/test-output.mjs";

const VITEST_4 = [
  " RUN  v4.0.18 /work/site",
  "",
  " ✓  unit  src/plugins/ui/__tests__/unit/state.test.ts (5 tests) 2ms",
  " ✓  unit  src/plugins/ui/__tests__/unit/modules.test.ts (13 tests) 121ms",
  " ✓  integration  tests/integration/boot.test.ts (2 tests) 4210ms",
  "     ✓ boots the whole app 4012ms",
  "",
  " Test Files  3 passed (3)",
  "      Tests  20 passed (20)",
  "   Start at  19:17:08",
  "   Duration  4.75s (transform 482ms, setup 0ms, import 591ms, tests 4333ms, environment 0ms)",
].join("\n");

const VITEST_3_RED = [
  " ✓ |unit| tests/unit/setup.test.ts (1 test) 4ms",
  " ❯ |integration| tests/integration/visual.test.ts (5 tests | 3 failed) 81ms",
  "     ✓ runs every test without an error 1ms",
  "     × answers same at home 4ms",
  "",
  " Test Files  1 failed | 1 passed (2)",
  "      Tests  3 failed | 3 passed (6)",
  "   Duration  753ms (transform 60ms)",
].join("\n");

const BUN = [
  "bun test v1.3.14 (a1b2c3d4)",
  "",
  "tests/streak.test.ts:",
  "(pass) streak > counts a day [0.12ms]",
  "(pass) streak > survives midnight [1503.40ms]",
  "",
  "tests/boot.test.ts:",
  "(fail) boot > starts [12.00ms]",
  "",
  " 2 pass",
  " 1 fail",
  " 5 expect() calls",
  "Ran 3 tests across 2 files. [1.62s]",
].join("\n");

const NODE = [
  "▶ ledger",
  "  ✔ loads an empty ledger (0.61ms)",
  "  ✔ saves atomically (2250.5ms)",
  "✔ ledger (2252.9ms)",
  "✔ parses argv (0.2ms)",
  "ℹ tests 3",
  "ℹ suites 1",
  "ℹ pass 3",
  "ℹ fail 0",
  "ℹ duration_ms 2301.37",
].join("\n");

describe("parseTestOutput: Vitest", () => {
  it("reads the totals, the duration and the slowest files and tests, slowest first", () => {
    const output = parseTestOutput(VITEST_4);

    assert.equal(output.runner, "vitest");
    assert.deepEqual([output.passed, output.failed, output.ms], [20, 0, 4750]);
    assert.deepEqual(output.slowest.slice(0, 3), [
      { name: "tests/integration/boot.test.ts", ms: 4210 },
      { name: "tests/integration/boot.test.ts > boots the whole app", ms: 4012 },
      { name: "src/plugins/ui/__tests__/unit/modules.test.ts", ms: 121 },
    ]);
  });

  it("reads the older project badge and a red run", () => {
    const output = parseTestOutput(VITEST_3_RED);

    assert.deepEqual([output.passed, output.failed], [3, 3]);
    assert.equal(outcomeOf(output), "red");
    assert.equal(output.slowest[0].name, "tests/integration/visual.test.ts");
  });

  it("reads coloured output the same way", () => {
    const coloured = "\u001B[2m Test Files \u001B[22m \u001B[1m\u001B[31m3 failed\u001B[39m\u001B[22m\u001B[2m | \u001B[22m\u001B[1m\u001B[32m16 passed\u001B[39m\u001B[22m\u001B[90m (19)\u001B[39m\n\u001B[2m      Tests \u001B[22m \u001B[1m\u001B[31m15 failed\u001B[39m\u001B[22m\u001B[2m | \u001B[22m\u001B[1m\u001B[32m187 passed\u001B[39m\u001B[22m\u001B[90m (202)\u001B[39m\n";

    assert.deepEqual([parseTestOutput(coloured).passed, parseTestOutput(coloured).failed], [187, 15]);
  });

  it("adds up two runs printed one after the other, the way a hook job prints them", () => {
    const twice = " Test Files  2 passed (2)\n      Tests  10 passed (10)\n   Duration  1.00s\n Test Files  1 passed (1)\n      Tests  4 passed (4)\n   Duration  500ms\n";

    assert.deepEqual([parseTestOutput(twice).passed, parseTestOutput(twice).ms], [14, 1500]);
  });

  it("counts a file that did not load, an unhandled error and a missed coverage threshold as failures", () => {
    assert.equal(outcomeOf(parseTestOutput(" Test Files  1 failed (1)\n      Tests  no tests\n")), "red");
    assert.equal(outcomeOf(parseTestOutput(" Test Files  2 passed (2)\n      Tests  9 passed (9)\n     Errors  1 error\n")), "red");
    assert.equal(outcomeOf(parseTestOutput(" Test Files  2 passed (2)\n      Tests  9 passed (9)\nERROR: Coverage for lines (71%) does not meet global threshold (90%)\n")), "red");
  });
});

describe("parseTestOutput: bun test", () => {
  it("reads the totals, the duration and each timed test under its file", () => {
    const output = parseTestOutput(BUN);

    assert.equal(output.runner, "bun");
    assert.deepEqual([output.passed, output.failed, output.ms], [2, 1, 1620]);
    assert.deepEqual(output.slowest[0], { name: "tests/streak.test.ts > streak > survives midnight", ms: 1503 });
    assert.equal(outcomeOf(output), "red");
  });

  it("reads a run that printed its totals and no test lines", () => {
    const output = parseTestOutput(" 12 pass\n 0 fail\n 30 expect() calls\nRan 12 tests across 3 files. [45.00ms]\n");

    assert.deepEqual([output.passed, output.failed, output.ms, output.slowest], [12, 0, 45, []]);
    assert.equal(outcomeOf(output), "green");
  });
});

describe("parseTestOutput: node --test", () => {
  it("reads the totals and the tests, and leaves out the closing line of a suite", () => {
    const output = parseTestOutput(NODE);

    assert.equal(output.runner, "node");
    assert.deepEqual([output.passed, output.failed, output.ms], [3, 0, 2301]);
    assert.deepEqual(output.slowest, [{ name: "saves atomically", ms: 2251 }, { name: "loads an empty ledger", ms: 1 }, { name: "parses argv", ms: 0 }]);
  });

  it("reads the TAP totals without timings", () => {
    const output = parseTestOutput("ok 1 - a\n# tests 1\n# pass 0\n# fail 1\n");

    assert.deepEqual([output.failed, output.slowest], [1, []]);
  });
});

describe("parseTestOutput: anything else", () => {
  it("answers nothing for an output it does not know, and nothing is guessed from it", () => {
    assert.equal(parseTestOutput("PASS src/a.test.js (5.1 s)\nTests: 3 passed, 3 total\n"), undefined);
    assert.equal(parseTestOutput(""), undefined);
    assert.equal(outcomeOf(undefined), undefined);
    assert.deepEqual(readings(undefined), {});
  });

  it("answers nothing when a filter cut the totals away", () => {
    assert.equal(parseTestOutput(" ✓  unit  tests/unit/a.test.ts (3 tests) 4ms\n"), undefined);
  });

  it("is neither green nor red when no test passed and none failed", () => {
    assert.equal(outcomeOf(parseTestOutput(" 0 pass\n 0 fail\nRan 0 tests across 0 files. [1.00ms]\n")), undefined);
  });
});
