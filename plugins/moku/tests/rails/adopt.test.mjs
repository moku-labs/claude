import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { LEDGER_VERSION, loadLedger, migrate, saveLedger } from "../../lib/rails/ledger.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** Run the CLI inside a project directory and capture code plus output. */
function rails(root, ...args) {
  const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8" });
  return { code: run.status, text: `${run.stdout}${run.stderr}` };
}

/** A temp directory holding the given files, as a fresh clone would: no `.planning/`. */
function clone(files) {
  const root = mkdtempSync(join(tmpdir(), "moku-adopt-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

/** Every file of the directory outside `.planning/`, with its content, to prove adopt wrote none of them. */
function snapshot(root, dir = "") {
  const files = {};
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (path === ".planning") continue;
    if (entry.isDirectory()) Object.assign(files, snapshot(root, path));
    else files[path] = readFileSync(join(root, path), "utf8");
  }
  return files;
}

const WEB_APP = {
  "package.json": { name: "habits", dependencies: { "@moku-labs/web": "^2.4.19" }, devDependencies: { "@moku-labs/ci": "1.5.8" }, scripts: { test: "node -e \"process.exit(0)\"" } },
  "src/index.ts": "import { createApp } from \"@moku-labs/web\";\nexport const app = createApp({ plugins: [] });\n",
  "src/plugins/streak/index.ts": "export const streak = {};\n",
  "src/plugins/habits/index.ts": "export const habits = {};\n",
  "biome.json": "{}\n",
  "CLAUDE.md": "# habits\n",
};

const GAME = {
  "package.json": { name: "a-memory-missing", dependencies: { "@moku-labs/core": "1.7.6", "@moku-labs/game": "0.15.101" }, devDependencies: { "@moku-labs/editor": "0.10.21" } },
  "index.ts": "import { defineGameApp } from \"@moku-labs/game\";\nexport default defineGameApp({});\n",
  "config.ts": "export default {};\n",
  "plugins/save/index.ts": "export const save = {};\n",
};

const FRAMEWORK = {
  "package.json": { name: "@moku-labs/editor", dependencies: { preact: "10.29.8" }, devDependencies: { "@moku-labs/core": "1.7.6", "@moku-labs/game": "^0.15.90" } },
  "src/config.ts": "import { createCoreConfig } from \"@moku-labs/core\";\n",
};

describe("moku-rails adopt: an existing project with no .planning/", () => {
  it("refuses an empty folder, names init, and writes nothing", () => {
    const root = clone({});

    const adopted = rails(root, "adopt");

    assert.equal(adopted.code, 2, adopted.text);
    assert.match(adopted.text, /no moku code here/);
    assert.match(adopted.text, /Next step: init/);
    assert.equal(existsSync(join(root, ".planning")), false);
  });

  it("adopts a web app: state.json and the marker, and not one file outside .planning/", () => {
    const root = clone(WEB_APP);
    const before = snapshot(root);

    const adopted = rails(root, "adopt");

    assert.equal(adopted.code, 0, adopted.text);
    assert.match(adopted.text, /Adopted habits \(consumer\)/);
    assert.deepEqual(snapshot(root), before);

    const marker = readFileSync(join(root, ".planning", "moku.md"), "utf8");
    assert.match(marker, /^type: consumer$/m);
    assert.match(marker, /^name: habits$/m);
    assert.match(marker, /^- @moku-labs\/web \^2\.4\.19$/m);
    assert.match(marker, /^- habits$/m);
    assert.match(marker, /^- streak$/m);

    const state = JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8"));
    assert.equal(state.version, LEDGER_VERSION);
    assert.equal(state.milestone, null);
    assert.deepEqual(state.changes, []);
  });

  it("adopts a game with its core version, and source writes open at the build station", () => {
    const root = clone(GAME);

    assert.equal(rails(root, "adopt").code, 0);
    const marker = readFileSync(join(root, ".planning", "moku.md"), "utf8");
    assert.match(marker, /^type: game$/m);
    assert.match(marker, /^core_version: 1\.7\.6$/m);
    assert.match(marker, /^- save$/m);

    // Before a change the gate holds; inside build it opens, the same as in a project init built
    assert.equal(rails(root, "guard", "features/board/index.ts").code, 2);
    rails(root, "open", "2026-11-05-board", "--size", "S", "--type", "fix", "--title", "Board");
    rails(root, "enter", "build");
    const verdict = rails(root, "guard", "features/board/index.ts");
    assert.equal(verdict.code, 0, verdict.text);
  });

  it("reads a framework by createCoreConfig, even when it develops against the game", () => {
    const root = clone(FRAMEWORK);

    assert.equal(rails(root, "adopt").code, 0);
    assert.match(readFileSync(join(root, ".planning", "moku.md"), "utf8"), /^type: framework$/m);
  });

  it("changes nothing when it runs again", () => {
    const root = clone(WEB_APP);
    rails(root, "adopt");
    const marker = readFileSync(join(root, ".planning", "moku.md"), "utf8");
    const state = readFileSync(join(root, ".planning", "state.json"), "utf8");

    const again = rails(root, "adopt");

    assert.equal(again.code, 0, again.text);
    assert.match(again.text, /Already adopted/);
    assert.equal(readFileSync(join(root, ".planning", "moku.md"), "utf8"), marker);
    assert.equal(readFileSync(join(root, ".planning", "state.json"), "utf8"), state);
  });

  it("completes a partial .planning/ and keeps what it holds", () => {
    const root = clone({ ...WEB_APP, ".planning/STATE.md": "# plan\n" });
    rails(root, "session", "start");
    rails(root, "idea", "dark mode");

    const adopted = rails(root, "adopt");

    assert.equal(adopted.code, 0, adopted.text);
    assert.match(adopted.text, /wrote \.planning\/moku\.md, kept \.planning\/state\.json/);
    assert.equal(readFileSync(join(root, ".planning", "STATE.md"), "utf8"), "# plan\n");
    assert.deepEqual(loadLedger(root).ideas, ["dark mode"]);
  });

  it("keeps a marker that is already there, whatever type it was asked for", () => {
    const root = clone({ ...WEB_APP, ".planning/moku.md": "# Moku Project\n\ntype: tools\nname: habits\n" });

    const adopted = rails(root, "adopt", "--type", "consumer");

    assert.equal(adopted.code, 0, adopted.text);
    assert.match(adopted.text, /wrote \.planning\/state\.json, kept \.planning\/moku\.md/);
    assert.match(adopted.text, /already says type: tools/);
    assert.match(readFileSync(join(root, ".planning", "moku.md"), "utf8"), /^type: tools$/m);
  });

  it("refuses while the init station is scaffolding", () => {
    const root = clone(WEB_APP);
    rails(root, "init", "begin");

    const adopted = rails(root, "adopt");

    assert.equal(adopted.code, 2, adopted.text);
    assert.match(adopted.text, /init station started here/);
    assert.equal(existsSync(join(root, ".planning", "moku.md")), false);
  });

  it("names adopt, not init, where moku code has no .planning/", () => {
    const root = clone(GAME);

    assert.match(rails(root, "status").text, /moku game project with no \.planning\/ here.*moku-rails adopt/);
    assert.match(rails(root, "session", "start").text, /NOT initialized here, but the directory holds a moku game project.*moku-rails adopt/);
  });

  it("still names the session for an empty folder, and init's own route is unchanged", () => {
    const root = clone({});

    assert.doesNotMatch(rails(root, "status").text, /adopt/);
    assert.equal(rails(root, "init", "begin").code, 0);
    writeFileSync(join(root, ".planning", "moku.md"), "type: tools\nname: empty\n");
    assert.equal(rails(root, "init", "done").code, 0);
  });

  it("a change id still moves a change between worktrees, as before", () => {
    const root = clone(WEB_APP);
    rails(root, "adopt");

    const moved = rails(root, "adopt", "2026-11-05-nothing");

    assert.equal(moved.code, 2);
    assert.match(moved.text, /No other checkout holds a change/);
  });
});

describe("state.json schema", () => {
  it("migrates a version 1 ledger when it is read, and saves it as the current version", () => {
    const root = clone({});
    mkdirSync(join(root, ".planning"));
    const change = { id: "2026-09-26-streak", title: "Streak", type: "fix", size: "S", status: "open", station: "build", done: ["intake"], checklist: {}, paused: false };
    writeFileSync(join(root, ".planning", "state.json"), JSON.stringify({ version: 1, changes: [change], ideas: ["x"], testsGreenAt: "abc" }));

    const ledger = loadLedger(root);

    assert.equal(ledger.version, LEDGER_VERSION);
    assert.equal(ledger.milestone, null);
    assert.equal(ledger.changes[0].station, "build");

    saveLedger(root, ledger);
    const disk = JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8"));
    assert.equal(disk.version, LEDGER_VERSION);
    assert.equal(disk.milestone, null);
    assert.deepEqual(disk.ideas, ["x"]);
    assert.equal(disk.testsGreenAt, "abc");
  });

  it("reads a file with no version and no lists as an empty version 2 ledger", () => {
    assert.deepEqual(migrate({}), { version: 2, milestone: null, changes: [], ideas: [] });
  });

  it("keeps a milestone that is set, across a save that does not touch it", () => {
    const root = clone({});
    mkdirSync(join(root, ".planning"));
    writeFileSync(join(root, ".planning", "state.json"), JSON.stringify({ version: 2, milestone: "v1-launch", changes: [], ideas: [] }));

    const ledger = loadLedger(root);
    ledger.ideas.push("y");
    saveLedger(root, ledger);

    assert.equal(loadLedger(root).milestone, "v1-launch");
  });
});
