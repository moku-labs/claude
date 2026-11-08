import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

import { compareAll, compareRow, normalizeGradient, toPrototypePx } from "../../lib/fidelity/compare.mjs";
import { addDeviation, decide, readDeviations } from "../../lib/fidelity/deviations.mjs";
import { buildInventory, normalizeSpec } from "../../lib/fidelity/inventory.mjs";
import { boxDiff, decodePng } from "../../lib/fidelity/png.mjs";
import { pageProbe } from "../../lib/fidelity/probe.mjs";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-fidelity");

const box = (extra = {}) => ({ present: true, x: 14, y: 350, w: 362, h: 72, drawn: ["fill", "stroke"], fill: "rgba(251, 243, 226, 0.3)", gradient: null, stroke: { width: 1, color: "rgba(255, 255, 255, 0.5)" }, radius: 20, shadow: "none", opacity: 0.6, ...extra });
const text = (extra = {}) => ({ ...box({ drawn: [], fill: "rgba(0, 0, 0, 0)", stroke: null, opacity: 1 }), text: "Claim", family: "Fredoka", weight: "700", size: 26, lineHeight: 31, letterSpacing: 0, color: "rgb(255, 255, 255)", ...extra });
const row = (el, prop) => ({ el, prop });

describe("the fixed inventory", () => {
  const spec = normalizeSpec({ sizes: [{ w: 390, h: 844, safe: { top: 47, bottom: 34 } }, { w: 768, h: 1024 }], states: [{ id: "default" }, { id: "misted", query: "?state=misted" }] });
  const values = Object.fromEntries(spec.sizes.map((size) => [size.id, { default: { title: text(), blank1: { present: false } }, misted: { title: text(), blank1: box() } }]));

  it("is element × property × size × state, decided by the prototype, the same on every build", () => {
    const rows = buildInventory(spec, values);
    assert.equal(rows.length, buildInventory(spec, structuredClone(values)).length);
    // title: 15 rows (box + text) × 4 cells; blank1: 1 (absent) + 9 × 2 sizes; page: 4 rules at the safe size, 3 at the other, × 2 states
    assert.equal(rows.length, 15 * 4 + (1 + 9) * 2 + (4 + 3) * 2);
    assert.ok(rows.some((item) => item.row === "blank1|drawn|390x844|misted"));
    assert.ok(rows.some((item) => item.row === "@page|inside-safe-area|390x844|default"));
    assert.ok(!rows.some((item) => item.row === "@page|inside-safe-area|768x1024|default"));
  });
});

describe("the comparison", () => {
  it("finds a shape drawn as a sprite although the boxes agree", () => {
    const sprite = box({ drawn: ["image"], fill: "rgba(0, 0, 0, 0)", stroke: null, image: "frost-row-locked.png" });
    const result = compareRow(row("blank1", "drawn"), { blank1: box() }, { blank1: sprite }, 1, { h: 844 });
    assert.equal(result.result, "fail");
    assert.match(result.note, /prototype paints fill\+stroke, the build image \(frost-row-locked\.png\)/);
    assert.equal(compareRow(row("blank1", "size"), { blank1: box() }, { blank1: sprite }, 1, { h: 844 }).result, "pass");
    assert.equal(compareRow(row("blank1", "stroke"), { blank1: box() }, { blank1: sprite }, 1, { h: 844 }).result, "covered", "inside the picture: the drawn row carries it");
  });

  it("is strict on type: a line height 1 px off on a 21 px face fails, 0.4 px passes", () => {
    const at = (lineHeight) => compareRow(row("t", "line-height"), { t: text({ size: 21, lineHeight: 24.78 }) }, { t: text({ size: 21, lineHeight }) }, 1, { h: 844 }).result;
    assert.equal(at(25.18), "pass");
    assert.equal(at(25.81), "fail");
  });

  it("fails a local shift and passes the same layout stretched to another device", () => {
    const page = { card: box({ x: 20, y: 100, w: 350, h: 300 }), title: text({ x: 36, y: 116, w: 200, h: 31, lineHeight: 31 }), price: text({ x: 36, y: 160, w: 120, h: 31, lineHeight: 31 }) };
    const stretch = (b, s) => ({ ...b, x: 195 + (b.x - 195) * s, w: b.w * s, y: b.y * s, h: b.h * s });
    const stretched = Object.fromEntries(Object.entries(page).map(([id, b]) => [id, stretch(b, 1.03)]));
    assert.equal(compareRow(row("price", "position"), page, stretched, 1, { h: 844 }).result, "pass");
    const shifted = { ...page, price: { ...page.price, y: page.price.y + 8 } };
    assert.equal(compareRow(row("price", "position"), page, shifted, 1, { h: 844 }).result, "fail");
    assert.equal(compareRow(row("price", "position"), page, { ...page, price: { ...page.price, y: page.price.y + 1.5 } }, 1, { h: 844 }).result, "pass", "device pixels and rounding never fail");
  });

  it("compares a one-line text box by its height: a game measures glyphs, a page the block", () => {
    const want = { count: text({ w: 268, h: 17, size: 13, lineHeight: 17 }) };
    assert.equal(compareRow(row("count", "size"), want, { count: text({ w: 77, h: 17, size: 13, lineHeight: 17 }) }, 1, { h: 844 }).result, "pass");
    assert.equal(compareRow(row("count", "size"), want, { count: text({ w: 77, h: 30, size: 13, lineHeight: 17 }) }, 1, { h: 844 }).result, "fail");
  });

  it("compares game units in prototype px with the exact factor of each frame", () => {
    const k = 1080 / 768;
    const game = toPrototypePx(text({ lineHeight: 38 * k + 1.1 * k, size: 32 * k }), k);
    assert.equal(compareRow(row("t", "line-height"), { t: text({ lineHeight: 38 }) }, { t: text({ lineHeight: 38 * k + 1.1 * k }) }, k, { h: 1024 }).result, "fail");
    assert.equal(compareRow(row("t", "line-height"), { t: text({ lineHeight: 38 }) }, { t: text({ lineHeight: 38 * k + 0.4 * k }) }, k, { h: 1024 }).result, "pass");
    assert.ok(Math.abs(game.size - 32) < 1e-9);
  });

  it("reads equal gradients written two ways as equal", () => {
    assert.equal(normalizeGradient("linear-gradient(rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%)"), normalizeGradient("linear-gradient(180deg, rgb(1, 2, 3), rgb(4, 5, 6))"));
    assert.notEqual(normalizeGradient("linear-gradient(90deg, rgb(1, 2, 3), rgb(4, 5, 6))"), normalizeGradient("linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))"));
  });

  it("keeps a deviation's rows open until the person decides, then by decision; PASS only with none waiting", () => {
    const spec = normalizeSpec({ sizes: [{ w: 390, h: 844 }] });
    const values = { "390x844": { default: { help: text({ weight: "800" }) } } };
    const expected = { spec, values, inventory: buildInventory(spec, values) };
    const actual = { values: { "390x844": { default: { help: text({ weight: "700" }), "@page": { scrollW: 390, innerW: 390, clipped: [] } } } } };
    const deviation = { id: "D1", element: "help", prop: "font", kind: "impossible", reason: "800 is not vendored", proposal: "700", decision: null };

    const pending = compareAll(expected, actual, [deviation]);
    assert.equal(pending.rows.find((item) => item.prop === "font").result, "open");
    assert.equal(pending.summary.verdict, "FAIL");

    const accepted = compareAll(expected, actual, [{ ...deviation, decision: { answer: "accept", words: "700 is fine" } }]);
    assert.equal(accepted.rows.find((item) => item.prop === "font").result, "decision");
    assert.equal(accepted.summary.verdict, "PASS");
  });

  it("counts an unmeasured target size against the verdict", () => {
    const spec = normalizeSpec({ sizes: [{ w: 390, h: 844 }, { w: 768, h: 1024 }] });
    const values = { "390x844": { default: { t: text() } }, "768x1024": { default: { t: text() } } };
    const { summary } = compareAll({ spec, values, inventory: buildInventory(spec, values) }, { values: { "390x844": values["390x844"] } });
    assert.deepEqual(summary.missingSizes, ["768x1024"]);
    assert.equal(summary.verdict, "FAIL");
  });
});

describe("deviations", () => {
  it("are raised with a time before any decision, and decided by the person", () => {
    const file = join(mkdtempSync(join(tmpdir(), "moku-dev-")), "deviations.json");
    const made = addDeviation(file, { element: "glow", prop: "shadow", kind: "impossible", reason: "the engine cannot blur", proposal: "a hard ring", by: "moku-builder" });
    assert.equal(made.id, "D1");
    assert.equal(made.decision, null);
    assert.ok(Date.parse(made.asked) > 0);
    assert.throws(() => addDeviation(file, { element: "x", kind: "guess", reason: "r", proposal: "p" }), /kind is one of/);

    decide(file, "D1", { answer: "accept", words: "rings are fine" });
    assert.equal(readDeviations(file)[0].decision.answer, "accept");
  });

  it("cover every element and property of one cause in one question", () => {
    const spec = normalizeSpec({ sizes: [{ w: 390, h: 844 }] });
    const values = { "390x844": { default: { a: box(), b: box() } } };
    const expected = { spec, values, inventory: buildInventory(spec, values) };
    const sprite = box({ drawn: ["image"], fill: "rgba(0, 0, 0, 0)", stroke: null, image: "frost" });
    const actual = { values: { "390x844": { default: { a: sprite, b: sprite, "@page": { scrollW: 390, innerW: 390, clipped: [] } } } } };
    const one = { id: "D1", element: ["a", "b"], prop: ["drawn", "fill", "stroke"], kind: "conflict", reason: "the kit draws rows as a sprite", proposal: "keep the sprite", decision: null };
    const rows = compareAll(expected, actual, [one]).rows.filter((item) => ["drawn", "fill", "stroke"].includes(item.prop));
    assert.equal(rows.length, 6);
    assert.ok(rows.filter((item) => item.prop === "drawn").every((item) => item.result === "open" && item.deviation === "D1"));
    assert.ok(rows.filter((item) => item.prop !== "drawn").every((item) => item.result === "covered"), "fill and stroke are inside the picture");
  });
});

describe("the per-element pixel diff", () => {
  it("decodes a browser PNG and gives the share of differing pixels in a box", () => {
    const a = decodePng(png(4, 2, (x) => (x < 2 ? [255, 0, 0] : [0, 0, 255])));
    const b = decodePng(png(4, 2, () => [255, 0, 0]));
    assert.equal(boxDiff(a, b, { x: 0, y: 0, w: 2, h: 2 }), 0);
    assert.equal(boxDiff(a, b, { x: 0, y: 0, w: 4, h: 2 }), 50);
  });
});

describe("moku-fidelity through the browser pane (probe → ingest → compare)", () => {
  it("captures a fixed inventory, compares, and writes the verdict line the rails read", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "moku-fid-")), "cards");
    mkdirSync(dir, { recursive: true });
    const run = (...args) => spawnSync("node", [BIN, ...args], { encoding: "utf8" });
    const probe = (file, data) => {
      writeFileSync(file, JSON.stringify(JSON.stringify(data)));
      return file;
    };

    writeFileSync(join(dir, "spec.json"), JSON.stringify({ sizes: [{ w: 390, h: 844 }], states: [{ id: "misted", query: "?state=misted" }] }));
    const page = { "@page": { scrollW: 390, innerW: 390, clipped: [] } };
    assert.equal(run("ingest", dir, "--side", "expected", "--size", "390x844", "--state", "misted", "--file", probe(join(dir, "e.json"), { blank1: box(), ...page })).status, 0);
    const expected = JSON.parse(readFileSync(join(dir, "check", "expected.json"), "utf8"));
    assert.equal(expected.inventory.length, 9 + 3);

    run("ingest", dir, "--side", "actual", "--size", "390x844", "--state", "misted", "--file", probe(join(dir, "a.json"), { blank1: box({ drawn: ["image"], stroke: null, fill: "rgba(0, 0, 0, 0)" }), ...page }));
    const compared = run("compare", dir);
    assert.equal(compared.status, 1);
    assert.match(compared.stdout, /^Verdict: FAIL/m);
    assert.match(readFileSync(join(dir, "check", "design-check.md"), "utf8"), /^Verdict: FAIL {4}Rows: 12/m);

    const raised = run("deviate", dir, "--element", "blank1", "--kind", "conflict", "--reason", "today's row is a sprite", "--proposal", "keep the sprite");
    assert.match(raised.stdout, /D1 raised/);
    run("decide", dir, "D1", "--answer", "accept", "--words", "keep today's row");
    assert.equal(run("compare", dir).status, 0);
    assert.match(readFileSync(join(dir, "check", "design-check.md"), "utf8"), /^Verdict: PASS/m);
  });
});

/**
 * A tiny RGB PNG.
 *
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => number[]} colour
 */
function png(width, height, colour) {
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) raw.push(...colour(x, y));
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(raw))), chunk("IEND", Buffer.alloc(0))]);
}

describe("the game probe", () => {
  it("gives a measured element the paint of its unmeasured keyed children", () => {
    const tree = { key: "root", rect: { x: 0, y: 0, w: 390, h: 844 }, children: [
      { key: "caseBlank:blank1", type: "box", rect: { x: 14, y: 350, w: 362, h: 72 }, style: {}, children: [
        { key: "caseBlank:blank1:body", type: "box", rect: { x: 14, y: 350, w: 362, h: 72 }, style: { nineSlice: "frost-row-locked" }, children: [] },
      ] },
      { key: "caseDock", type: "box", rect: { x: 0, y: 700, w: 390, h: 144 }, style: {}, children: [
        { key: "caseBlank:blank2", type: "box", rect: { x: 0, y: 0, w: 1, h: 1 }, style: { fill: 0xffffff }, children: [] },
      ] },
    ] };
    const saved = { doors: globalThis.doors, game: globalThis.game, document: globalThis.document, innerWidth: globalThis.innerWidth };
    globalThis.innerWidth = 390;
    globalThis.doors = { sources: { ui: "ui" }, read: () => tree };
    globalThis.game = {};
    globalThis.document = { querySelector: () => null, scrollingElement: null };
    try {
      const out = pageProbe({ elements: { blank1: { game: { key: "caseBlank:blank1" } }, blank2: { game: { key: "caseBlank:blank2" } }, dock: { game: { key: "caseDock" } } }, reference: 390 });
      assert.deepEqual(out.blank1.drawn, ["image"]);
      assert.equal(out.blank1.image, "frost-row-locked");
      assert.deepEqual(out.dock.drawn, [], "a measured child keeps its own paint");
    } finally {
      Object.assign(globalThis, saved);
    }
  });
});
