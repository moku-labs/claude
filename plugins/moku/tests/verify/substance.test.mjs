import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { judgeSource, judgeTest, realLines } from "../../lib/verify/substance.mjs";

describe("realLines", () => {
  it("drops blanks, comments and imports", () => {
    const lines = realLines("// note\nimport x from 'y';\n\nconst a = 1;\nconst b = 2;");

    assert.deepEqual(lines, ["const a = 1;", "const b = 2;"]);
  });
});

describe("judgeSource", () => {
  it("accepts a real implementation", () => {
    const source = "export const api = (ctx) => ({\n  count: () => ctx.state.count,\n  bump: () => { ctx.state.count += 1; },\n  reset: () => { ctx.state.count = 0; },\n});";

    assert.equal(judgeSource(source).stub, false);
  });

  it("flags a not-implemented throw", () => {
    const verdict = judgeSource('export function api() {\n  throw new Error("not implemented yet");\n}\nconst keep = 1;\nconst also = 2;');

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /not implemented/);
  });

  it("flags an empty function body", () => {
    const verdict = judgeSource("export const onInit = () => {};\nconst a = 1;\nconst b = 2;\nconst c = 3;");

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /empty function body/);
  });

  it("flags a file that is only a TODO", () => {
    const verdict = judgeSource("// TODO: implement the streak api\n");

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /TODO/);
  });

  it("flags a file with too few real lines", () => {
    const verdict = judgeSource("import { x } from './x';\nconst a = 1;");

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /minimum/);
  });
});

describe("judgeTest", () => {
  it("accepts a test with real assertions", () => {
    const source = "it('bumps the streak', () => {\n  const api = make();\n  api.bump();\n  expect(api.count()).toBe(1);\n});";

    assert.equal(judgeTest(source).stub, false);
  });

  it("flags a test with no assertions", () => {
    const verdict = judgeTest("it('works', () => {\n  const api = make();\n  api.bump();\n  api.reset();\n});");

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /no assertions/);
  });

  it("flags a tautological assertion", () => {
    const verdict = judgeTest("it('works', () => {\n  const api = make();\n  api.bump();\n  expect(true).toBe(true);\n});");

    assert.equal(verdict.stub, true);
    assert.match(verdict.reasons.join(" "), /tautological/);
  });
});
