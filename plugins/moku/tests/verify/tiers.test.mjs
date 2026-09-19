import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expectedFiles, inferTier, normalizeTier, readDeclaredTier } from "../../lib/verify/tiers.mjs";

describe("normalizeTier", () => {
  it("accepts the written forms of very complex", () => {
    assert.equal(normalizeTier("VeryComplex"), "very-complex");
    assert.equal(normalizeTier(" very-complex "), "very-complex");
  });

  it("rejects anything that is not a tier", () => {
    assert.equal(normalizeTier("huge"), null);
    assert.equal(normalizeTier(undefined), null);
  });
});

describe("readDeclaredTier", () => {
  it("reads the tier from an index header", () => {
    assert.equal(readDeclaredTier("/**\n * Streak plugin.\n * Tier: Standard\n */"), "standard");
  });

  it("returns null when no tier is declared", () => {
    assert.equal(readDeclaredTier("/** Streak plugin. */"), null);
  });
});

describe("inferTier", () => {
  it("calls a flat single file micro", () => {
    assert.equal(inferTier(["index.ts", "README.md"]), "micro");
  });

  it("calls a directory with domain files standard", () => {
    assert.equal(inferTier(["index.ts", "api.ts", "types.ts"]), "standard");
  });

  it("calls a directory with sub-modules complex", () => {
    assert.equal(inferTier(["index.ts", "types.ts", "routing/match.ts"]), "complex");
  });
});

describe("expectedFiles", () => {
  it("asks a nano plugin for one file, a readme and one test", () => {
    assert.deepEqual(expectedFiles("nano", "streak").required, ["index.ts", "README.md", "__tests__/unit/index.test.ts"]);
  });

  it("asks a standard plugin for types and an integration test", () => {
    const { required, conditional } = expectedFiles("standard", "streak");

    assert.ok(required.includes("types.ts"));
    assert.ok(required.includes("__tests__/integration/streak.test.ts"));
    assert.deepEqual(
      conditional.find((entry) => entry.when === "api.ts"),
      { when: "api.ts", then: "__tests__/unit/api.test.ts" },
    );
  });
});
