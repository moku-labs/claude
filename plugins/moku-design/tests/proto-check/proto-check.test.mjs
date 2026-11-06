import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { findChrome } from "../../lib/proto-check/cdp.mjs";
import { checkContract, columnsPresent, extractContract, filled, parseSize } from "../../lib/proto-check/contract.mjs";
import { durationMs, frameUrl } from "../../lib/proto-check/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const GOOD = join(here, "fixtures", "good-web.html");
const BIN = join(here, "..", "..", "bin", "moku-proto-check");
const goodContract = () => extractContract(readFileSync(GOOD, "utf8")).contract;

describe("extractContract", () => {
  it("reads the moku-design block", () => {
    assert.equal(goodContract().signature, "modal-in");
  });

  it("names a missing block and broken JSON", () => {
    assert.match(extractContract("<html></html>").error, /no <script/);
    assert.match(extractContract('<script type="application/json" id="moku-design">{nope</script>').error, /not valid JSON/);
  });
});

describe("filled", () => {
  it("takes `none` as a value and placeholders as empty", () => {
    assert.equal(filled("none"), true);
    assert.equal(filled("0"), true);
    for (const empty of ["", " ", "—", "-", "TBD", "?", "…", undefined, null]) assert.equal(filled(empty), false, String(empty));
  });
});

describe("checkContract", () => {
  it("passes the fixture: eight columns in every row, every web event covered", () => {
    const result = checkContract(goodContract());

    assert.deepEqual(result.findings, []);
    assert.equal(result.fullRows, 2);
    assert.equal(columnsPresent(result), 8);
    assert.equal(result.events.covered, result.events.required);
  });

  it("names each column a row lacks", () => {
    const contract = goodContract();
    contract.motion[0].sound = "";
    contract.motion[0].reduced = "—";
    const result = checkContract(contract);

    assert.equal(result.fullRows, 1);
    assert.ok(result.findings.some((finding) => /"reveal" lacks sound, reduced/.test(finding)));
  });

  it("requires every game event as a row or a noMotion reason", () => {
    const contract = { ...goodContract(), medium: "game", noMotion: { idle: "a still board is the point" } };
    const result = checkContract(contract);

    assert.ok(result.events.missing.includes("reward"));
    assert.ok(!result.events.missing.includes("idle"));
    assert.ok(result.findings.some((finding) => /required events/.test(finding)));
  });

  it("asks for the motion character, the sizes and the adaptation rules", () => {
    const contract = { ...goodContract(), motionCharacter: "", viewports: [{ size: "390x844" }], adaptation: [] };
    const findings = checkContract(contract).findings.join("\n");

    assert.match(findings, /motionCharacter is empty/);
    assert.match(findings, /1 target sizes, a web concept declares at least 3/);
    assert.match(findings, /no adaptation rules/);
  });

  it("refuses a signature that is not a motion row", () => {
    assert.match(checkContract({ ...goodContract(), signature: "nope" }).findings.join("\n"), /signature "nope" is not the id/);
  });
});

describe("helpers", () => {
  it("reads sizes and durations", () => {
    assert.deepEqual(parseSize("390x844"), { width: 390, height: 844 });
    assert.equal(parseSize("390 by 844"), undefined);
    assert.equal(durationMs("320ms"), 320);
    assert.equal(durationMs("0.4s"), 400);
    assert.equal(durationMs("260–420 ms"), 260);
    assert.equal(durationMs("loop"), 300);
  });

  it("builds frame URLs without undefined parameters", () => {
    const url = new URL(frameUrl("/tmp/a.html", { state: "s1", play: undefined, vp: "390x844" }));

    assert.equal(url.searchParams.get("state"), "s1");
    assert.equal(url.searchParams.has("play"), false);
  });
});

describe("moku-proto-check render", { skip: findChrome() ? false : "no Chrome on this machine" }, () => {
  it("passes the fixture end to end", () => {
    const run = spawnSync(process.execPath, [BIN, GOOD], { encoding: "utf8" });

    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /proto-check: PASS — 2\/2 rows with 8\/8 columns/);
    assert.match(run.stdout, /Motion live: 2\/2; \?t= pauses: yes/);
  });

  it("fails a prototype that ignores ?state= and ?play=", () => {
    const dir = mkdtempSync(join(tmpdir(), "proto-check-test-"));
    const broken = join(dir, "broken.html");
    writeFileSync(broken, readFileSync(GOOD, "utf8").replace(/<script>\s*const params[\s\S]*?<\/script>/, "<script>console.error('boom')</script>"));
    const run = spawnSync(process.execPath, [BIN, broken], { encoding: "utf8" });

    assert.equal(run.status, 2);
    assert.match(run.stdout, /did not open this state/);
    assert.match(run.stdout, /\?play=reveal: the prototype does not know this motion/);
    assert.match(run.stdout, /console errors: boom/);
  });
});
