import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requiredBefore, routeFor } from "../../lib/rails/routes.mjs";
import { canClose, canEnter } from "../../lib/rails/transitions.mjs";

const ready = { initialized: true };
const fresh = { initialized: false };

describe("routes", () => {
  it("gives a small change the short route", () => {
    assert.deepEqual(routeFor("S"), ["intake", "build", "verify", "close"]);
  });

  it("never requires an optional station", () => {
    assert.deepEqual(requiredBefore("L", "build"), ["intake", "plan"]);
  });

  it("rejects an unknown size", () => {
    assert.throws(() => routeFor("XL"), /Unknown change size/);
  });
});

describe("canEnter", () => {
  it("refuses build in an uninitialized project and names init as the next step", () => {
    const verdict = canEnter(fresh, { size: "M", done: ["intake", "plan"] }, "build");

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "init");
  });

  it("allows talking and sketching before init", () => {
    assert.equal(canEnter(fresh, { size: "L", done: [] }, "intake").ok, true);
    assert.equal(canEnter(fresh, { size: "L", done: ["intake"] }, "design").ok, true);
  });

  it("refuses build without a plan on a medium change", () => {
    const verdict = canEnter(ready, { size: "M", done: ["intake"] }, "build");

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "plan");
  });

  it("lets a small fix go from intake straight to build", () => {
    assert.equal(canEnter(ready, { size: "S", done: ["intake"] }, "build").ok, true);
  });

  it("lets design be skipped on a large change", () => {
    assert.equal(canEnter(ready, { size: "L", done: ["intake"] }, "plan").ok, true);
  });

  it("refuses a station that is not on the route", () => {
    const verdict = canEnter(ready, { size: "S", done: ["intake"] }, "plan");

    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /not on the route/);
  });
});

describe("canClose", () => {
  const built = { size: "S", done: ["intake", "build", "verify"] };

  it("refuses to close with an unconfirmed checklist item and names it", () => {
    const verdict = canClose({ ...built, checklist: { tests: true, verify: true, docs: false } });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "docs");
  });

  it("refuses to close when verify never ran", () => {
    const verdict = canClose({ size: "S", done: ["intake", "build"], checklist: { tests: true, verify: true, docs: true } });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "verify");
  });

  it("closes a finished change", () => {
    assert.equal(canClose({ ...built, checklist: { tests: true, verify: true, docs: true } }).ok, true);
  });
});
