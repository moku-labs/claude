import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requiredBefore, routeFor, tweakTier } from "../../lib/rails/routes.mjs";
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

  it("lets design be skipped on a large change, once the skip is recorded", () => {
    assert.equal(canEnter(ready, { size: "L", done: ["intake"], skipped: ["brainstorm", "design"] }, "plan").ok, true);
  });

  it("refuses plan while an optional station was neither done nor skipped, and names it", () => {
    const verdict = canEnter(ready, { size: "L", done: ["intake", "brainstorm"] }, "plan");

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "design");
  });

  it("offers design to a medium change, since a feature can have UI", () => {
    assert.equal(canEnter(ready, { size: "M", done: ["intake"] }, "design").ok, true);
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

describe("the quick route", () => {
  it("goes from intake through tweak to verify, with no plan and no build", () => {
    assert.deepEqual(routeFor("Q"), ["intake", "tweak", "verify", "close"]);
    assert.equal(canEnter(ready, { size: "Q", done: ["intake"] }, "tweak").ok, true);
    assert.equal(canEnter(ready, { size: "Q", done: ["intake"] }, "build").ok, false);
  });

  it("does not reach verify before the person ended the edits", () => {
    const verdict = canEnter(ready, { size: "Q", done: ["intake"] }, "verify");

    assert.equal(verdict.ok, false);
    assert.equal(verdict.missing, "tweak");
  });

  it("still closes only with tests, verify and docs confirmed", () => {
    const change = { size: "Q", done: ["intake", "tweak", "verify"], checklist: { tests: true, verify: false, docs: true } };

    assert.equal(canClose(change).ok, false);
  });
});

describe("who makes a quick edit", () => {
  const exists = (path) => path !== "src/plugins/hud/new.ts";

  it("the fast agent takes one or two existing files that are nobody's public surface", () => {
    assert.deepEqual(tweakTier(["src/plugins/hud/view.ts"], { exists }), { tier: "fast", reasons: [] });
    assert.equal(tweakTier(["src/plugins/hud/view.ts", "src/plugins/hud/styles.css"], { exists }).tier, "fast");
  });

  it("the builder takes a third file, a new file, a public surface, root wiring, core and configuration", () => {
    const deep = (paths) => tweakTier(paths, { exists });

    assert.match(deep(["a.ts", "b.ts", "c.ts"].map((name) => `src/plugins/hud/${name}`)).reasons[0], /3 files, more than 2/);
    assert.match(deep(["src/plugins/hud/new.ts"]).reasons[0], /a new file/);
    assert.match(deep(["src/plugins/hud/index.ts"]).reasons[0], /public surface/);
    assert.match(deep(["src/plugins/hud/types.ts"]).reasons[0], /public surface/);
    assert.match(deep(["src/index.ts"]).reasons[0], /root wiring/);
    assert.match(deep(["src/core/kit.ts"]).reasons[0], /shared core/);
    assert.match(deep(["package.json"]).reasons[0], /tooling or configuration/);
    assert.match(deep(["vite.config.ts"]).reasons[0], /tooling or configuration/);
    assert.equal(deep([]).tier, "deep");
  });

  it("the builder takes an edit the fast agent missed twice", () => {
    assert.equal(tweakTier(["src/plugins/hud/view.ts"], { exists, misses: 1 }).tier, "fast");
    assert.match(tweakTier(["src/plugins/hud/view.ts"], { exists, misses: 2 }).reasons[0], /missed this edit 2 times/);
  });
});

describe("who makes a quick edit in a game", () => {
  const exists = () => true;
  const inGame = (paths) => tweakTier(paths, { exists, game: true });

  it("the builder takes the root wiring: the game, the root flow and the page", () => {
    for (const file of ["index.ts", "game.ts", "config.ts"]) {
      assert.deepEqual(inGame([file]), { tier: "deep", reasons: [`${file}: it is the game's root wiring`] }, file);
    }
  });

  it("the builder takes a door: the index of a layer, of a feature and of the plugins", () => {
    for (const file of ["shared/index.ts", "shared/rules/index.ts", "features/index.ts", "features/hello/index.ts", "plugins/index.ts"]) {
      assert.match(inGame([file]).reasons[0], /door of a layer or a feature/, file);
    }
  });

  it("the builder takes the public surface of the game's own plugin, and the state and the kit", () => {
    assert.match(inGame(["plugins/exit/index.ts"]).reasons[0], /plugin's public surface/);
    assert.match(inGame(["plugins/exit/api.ts"]).reasons[0], /plugin's public surface/);
    assert.match(inGame(["core/state.ts"]).reasons[0], /game's state or kit/);
    assert.match(inGame(["core/kit.ts"]).reasons[0], /game's state or kit/);
  });

  it("the fast agent keeps what is nobody's surface: a view, a node, a rule, strings, balance data", () => {
    for (const file of ["features/hello/views/hello-screen.tsx", "features/hello/flow/tap.ts", "features/hello/rules/score.ts", "features/hello/strings/en.json", "shared/assets.ts", "core/tables.ts", "plugins/exit/handlers.ts"]) {
      assert.deepEqual(inGame([file]), { tier: "fast", reasons: [] }, file);
    }
  });

  it("still counts files, new files and tooling the way every project does", () => {
    assert.match(inGame(["features/hello/flow/a.ts", "features/hello/flow/b.ts", "features/hello/flow/c.ts"]).reasons[0], /3 files, more than 2/);
    assert.match(tweakTier(["features/hello/flow/new.ts"], { exists: () => false, game: true }).reasons[0], /a new file/);
    assert.match(inGame(["package.json"]).reasons[0], /tooling or configuration/);
    assert.match(inGame(["vitest.config.ts"]).reasons[0], /tooling or configuration/);
    assert.match(inGame(["src/index.ts"]).reasons[0], /project's root wiring/);
  });

  it("leaves the same names alone in a project that is not a game", () => {
    for (const file of ["index.ts", "game.ts", "config.ts", "core/state.ts", "features/hello/index.ts", "shared/index.ts", "plugins/index.ts", "plugins/moku/index.ts"]) {
      assert.deepEqual(tweakTier([file], { exists }), { tier: "fast", reasons: [] }, file);
      assert.deepEqual(tweakTier([file], { exists, game: false }), { tier: "fast", reasons: [] }, file);
    }
  });
});
