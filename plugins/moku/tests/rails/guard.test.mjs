import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guardWrite } from "../../lib/rails/guard.mjs";

const building = [{ status: "open", station: "build" }];

describe("guardWrite", () => {
  it("blocks a plugin file in an empty directory: the catastrophe case", () => {
    const verdict = guardWrite("src/plugins/streak/index.ts", { isMokuProject: false, initialized: false, changes: [] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /not initialized/);
  });

  it("blocks source writes in an uninitialized moku project", () => {
    const verdict = guardWrite("src/main.ts", { isMokuProject: true, initialized: false, changes: [] });

    assert.equal(verdict.allow, false);
  });

  it("leaves a non-moku repository alone", () => {
    assert.equal(guardWrite("src/server.ts", { isMokuProject: false, initialized: false, changes: [] }).allow, true);
  });

  it("always allows planning files, docs and configs", () => {
    const facts = { isMokuProject: true, initialized: false, changes: [] };

    assert.equal(guardWrite(".planning/specs/streak.md", facts).allow, true);
    assert.equal(guardWrite("README.md", facts).allow, true);
  });

  it("blocks source writes when no change reached a writing station", () => {
    const verdict = guardWrite("src/plugins/streak/api.ts", { isMokuProject: true, initialized: true, changes: [{ status: "open", station: "plan" }] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /writing station/);
  });

  it("allows source writes while a change is being built", () => {
    assert.equal(guardWrite("src/plugins/streak/api.ts", { isMokuProject: true, initialized: true, changes: building }).allow, true);
  });

  it("ignores closed changes", () => {
    const verdict = guardWrite("src/main.ts", { isMokuProject: true, initialized: true, changes: [{ status: "closed", station: "build" }] });

    assert.equal(verdict.allow, false);
  });
});
