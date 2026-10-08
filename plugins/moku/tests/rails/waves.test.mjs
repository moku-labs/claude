import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isDone, markWave, nextWave, readWaves } from "../../lib/rails/waves.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

const STATE = `## Phase: build

## Plugins
| # | Wave | Name | Tier | Dependencies | Spec File | Build Status |
|---|------|------|------|-------------|-----------|--------------|
| 3 | 1 | router | Standard | none | .planning/specs/03-router.md | not started |
| 4 | 1 | site | Complex | env (core) | .planning/specs/04-site.md | not started |
| 5 | 2 | auth | Standard | router, site | .planning/specs/05-auth.md | not started |

## Wave Table
| Wave | Plugins | Status |
|------|---------|--------|
| 0 | log, env | verified |
| 1 | router, site | not started |
| 2 | auth | not started |
| 3 | _framework: src/index.ts exports_ | not started |

## Next Action: Run /moku:build resume
`;

describe("build waves", () => {
  it("reads the waves with each plugin's tier, spec and dependencies", () => {
    const { waves, problems } = readWaves(STATE);

    assert.deepEqual(problems, []);
    assert.deepEqual(waves.map((wave) => wave.plugins.map((plugin) => plugin.name)), [["log", "env"], ["router", "site"], ["auth"], []]);
    assert.deepEqual(waves[1].plugins[1], { name: "site", wave: 1, tier: "Complex", dependencies: ["env"], spec: ".planning/specs/04-site.md", status: "not started" });
    assert.equal(waves[3].framework, "framework: src/index.ts exports");
  });

  it("names the first wave that is not finished", () => {
    const { waves } = readWaves(STATE);

    assert.equal(isDone(waves[0]), true);
    assert.equal(nextWave(waves)?.wave, 1);
  });

  it("marks a wave and its plugins verified, so the next wave comes up", () => {
    const after = markWave(STATE, 1, "verified");

    assert.match(after, /\| 1 \| router, site \| verified \|/);
    assert.match(after, /\| 3 \| 1 \| router \| Standard \| none \| \.planning\/specs\/03-router\.md \| verified \|/);
    assert.match(after, /\| 5 \| 2 \| auth \| Standard \| router, site \| \.planning\/specs\/05-auth\.md \| not started \|/);
    assert.match(after, /## Next Action: Run \/moku:build resume/);
    assert.equal(nextWave(readWaves(after).waves)?.wave, 2);
  });

  it("reads a wave table as plans write it in the wild: a status with a commit, a name with a note", () => {
    const wild = `## Cycle 2 Wave Table
| Wave | Plugins | Status |
|------|---------|--------|
| 1 | contracts §1.3 (persistent + envelopes) | done (01288d1) |
| 2 | transport (serverSignaling, guard, inMemory sim), session (codeLength) | done (53cc8a7) — 3/3 green |
| 3 | roomHub | Verified |
| 4 | lobby, chat (history) | building |
`;
    const { waves, problems } = readWaves(wild);

    assert.deepEqual(problems, []);
    assert.deepEqual(waves.map((wave) => wave.plugins.map((plugin) => plugin.name)), [["contracts §1.3"], ["transport", "session"], ["roomHub"], ["lobby", "chat"]]);
    assert.deepEqual(waves.map(isDone), [true, true, true, false]);
    assert.equal(nextWave(waves)?.wave, 4);
  });

  it("refuses a plan whose plugin waits for a plugin of the same or a later wave", () => {
    const wrong = STATE.replace("| 1 | router, site | not started |\n| 2 | auth | not started |", "| 1 | router, auth | not started |\n| 2 | site | not started |");

    assert.match(readWaves(wrong).problems.join(" "), /Plugin "auth" is in wave 1 and depends on "router" in wave 1/);
    assert.match(readWaves(wrong).problems.join(" "), /depends on "site" in wave 2/);
  });

  it("names a plugin listed in two waves, and a state file with no wave table", () => {
    assert.match(readWaves(STATE.replace("| 2 | auth | not started |", "| 2 | auth, router | not started |")).problems.join(" "), /Plugin "router" is in two waves/);
    assert.match(readWaves("## Phase: plan\n").problems[0], /no `\| Wave \| Plugins \| Status \|` table/);
  });
});

describe("moku-rails waves", () => {
  /** A project on the rails with the plan above. */
  function planned() {
    const root = mkdtempSync(join(tmpdir(), "moku-waves-"));
    spawnSync("node", [CLI, "session", "start", "--root", root]);
    mkdirSync(join(root, ".planning"), { recursive: true });
    writeFileSync(join(root, ".planning", "STATE.md"), STATE);
    return root;
  }
  const waves = (root, ...args) => {
    const run = spawnSync("node", [CLI, "waves", ...args, "--root", root], { encoding: "utf8" });
    return { code: run.status, text: `${run.stdout}${run.stderr}` };
  };

  it("prints the waves and the next one with its plugins for the builders", () => {
    const root = planned();

    const text = waves(root).text;
    assert.match(text, /Wave 0: log, env \(done\)/);
    assert.match(text, /Wave 1: router, site \(not started\)/);
    assert.match(text, /Next: wave 1, 2 plugin\(s\) in parallel\./);

    const data = JSON.parse(waves(root, "--json").text).data;
    assert.deepEqual(data.next.plugins.map((plugin) => [plugin.name, plugin.tier, plugin.spec]), [["router", "Standard", ".planning/specs/03-router.md"], ["site", "Complex", ".planning/specs/04-site.md"]]);
  });

  it("walks the plan wave by wave with --done, and stops at framework work", () => {
    const root = planned();

    assert.match(waves(root, "--done", "1").text, /Next: wave 2, 1 plugin\(s\)\./);
    assert.match(readFileSync(join(root, ".planning", "STATE.md"), "utf8"), /\| 1 \| router, site \| verified \|/);
    assert.match(waves(root, "--done", "2").text, /Next: wave 3 is framework work with no plugin folder/);
    assert.match(waves(root, "--done", "3").text, /Every wave is done\./);
  });

  it("status names the next wave, so every turn starts with it", () => {
    const root = planned();
    const status = () => spawnSync("node", [CLI, "status", "--root", root], { encoding: "utf8" }).stdout;

    assert.match(status(), /Waves: next is wave 1 \(router, site\), 2 plugins that may be built in parallel\. `moku-rails waves` lists every wave\./);

    waves(root, "--done", "1");
    assert.match(status(), /Waves: next is wave 2 \(auth\)\. `moku-rails waves`/);

    waves(root, "--done", "2");
    assert.match(status(), /Waves: next is wave 3, framework work/);

    waves(root, "--done", "3");
    assert.doesNotMatch(status(), /Waves:/);
  });

  it("is refused without a plan, and with a plan that breaks the order", () => {
    const empty = mkdtempSync(join(tmpdir(), "moku-waves-"));
    spawnSync("node", [CLI, "session", "start", "--root", empty]);
    assert.equal(waves(empty).code, 2);

    const root = planned();
    writeFileSync(join(root, ".planning", "STATE.md"), STATE.replace("| 5 | 2 | auth | Standard | router, site |", "| 5 | 2 | auth | Standard | router, ghost |").replace("| 0 | log, env | verified |", "| 0 | log, env, auth | verified |"));
    const refused = waves(root);
    assert.equal(refused.code, 2);
    assert.match(refused.text, /Plugin "auth" is in two waves/);
  });
});
