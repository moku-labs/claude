/**
 * The comparison of the design check: every inventory row gets one result.
 *
 * Results:
 * - `pass` — within the tolerance.
 * - `open` — waiting on the person: a pending deviation names the row.
 * - `fail` — past the tolerance, a different value, or drawn by something else.
 * - `covered` — the build draws the element as a picture where the prototype paints it: its fill, stroke,
 *   radius and shadow are inside the picture, and the `drawn` row of the element carries the difference.
 * - `decision` — the person (or §9 of the design context) decided the build differs here.
 * - `unmeasured` — the build side has no value for the row. Counted against the verdict.
 *
 * Lengths are compared in prototype px: the build's value in target units is divided by the conversion
 * factor of its size (web 1; game `reference / width`), unrounded. The tolerances were chosen on data (PR6:
 * three human fixes of a real episode, 540 planted defects, planted jitter, rounding and a proportional
 * stretch across five viewports): type is strict, geometry is judged the way a layout is built.
 * - A position is the gap from the element's nearest edge to the nearest edge of its container or of a
 *   sibling, so a local shift fails and an adaptation that stretches the whole layout passes.
 * - Sizes, radii and gaps get a floor of a few px (device pixels, rounding) and a share of their own length.
 * - A one-line text box is compared by its height only: a page measures the block, a game the glyphs.
 */

import { PAGE, factor } from "./inventory.mjs";
import { MOTION, compareMotion } from "./motion.mjs";

/**
 * Tolerances in prototype px: a floor, and for lengths that scale a share of the length itself.
 * Type is strict (a line height 1 px off on a 21 px face was a real defect a person fixed).
 */
export const TOLERANCE = { gap: 3, gapShare: 0.04, size: 3, sizeShare: 0.03, radius: 2, radiusShare: 0.15, shadow: 1, stroke: 1, fontSize: 0.5, lineHeight: 0.5, lineHeightShare: 0.02, letterSpacing: 0.3, alpha: 0.02, channel: 1 };

/** The tolerance of one length: its floor, or its share of the expected value when that is larger. */
const allow = (floor, share, value) => Math.max(floor, share * Math.abs(Number(value) || 0));

/**
 * Compare every row of the inventory.
 *
 * @param {{ spec: any, inventory: any[], values: any }} expected the file `check/expected.json`
 * @param {{ values: any, motion?: any }} actual the file `check/actual.json`, with `motion.json`'s rows as `motion`
 * @param {any[]} [deviations] the entries of `deviations.json`
 * @returns {{ rows: any[], summary: any }}
 */
export function compareAll(expected, actual, deviations = []) {
  const sizes = new Map(expected.spec.sizes.map((size) => [size.id, size]));
  const rows = expected.inventory.map((item) => {
    if (item.el.startsWith(MOTION)) return applyDeviation({ ...item, ...compareMotion(item, expected.spec, actual.motion) }, deviations);

    const size = sizes.get(item.size);
    const k = factor(expected.spec.conversion, size);
    const exp = expected.values[item.size]?.[item.state];
    const act = actual.values?.[item.size]?.[item.state];
    const result = act === undefined ? { result: "unmeasured", expected: "", actual: "", note: "this size and state were not measured on the build" } : compareRow(item, exp, act, k, size);

    return applyDeviation({ ...item, ...result }, deviations);
  });

  return { rows, summary: summarize(rows, expected.spec, actual, deviations) };
}

/**
 * One row.
 *
 * @param {{ el: string, prop: string }} item
 * @param {Record<string, any>} exp the prototype's elements at this size and state
 * @param {Record<string, any>} act the build's elements at this size and state, in target units
 * @param {number} k target units per prototype px
 * @param {{ h: number, safe?: { top: number, bottom: number } }} size
 * @returns {{ result: string, expected: string, actual: string, note?: string }}
 */
export function compareRow(item, exp, act, k, size) {
  if (item.el === PAGE) return comparePage(item.prop, exp, act, k, size);

  const e = exp[item.el];
  const a = act[item.el] ? toPrototypePx(act[item.el], k) : undefined;

  if (item.prop === "present") {
    const want = e.present ? "present" : "absent";
    const got = a?.present ? "present" : "absent";
    return { result: want === got ? "pass" : "fail", expected: want, actual: a ? got : "missing" };
  }

  if (!a || !a.present) return { result: "unmeasured", expected: "", actual: "missing", note: "the element is missing on the build" };

  // Painted in the prototype, a picture in the build: the drawn row says so once, the rest is inside the picture
  if (["fill", "stroke", "radius", "shadow"].includes(item.prop) && (a.drawn ?? []).includes("image") && !(e.drawn ?? []).includes("image")) {
    return { result: "covered", expected: "", actual: `image${a.image ? ` (${a.image})` : ""}`, note: "drawn as a picture: see the drawn row" };
  }

  const oneLine = e.text !== undefined && Number.isFinite(e.lineHeight) && e.h < 1.5 * e.lineHeight;
  const COMPARE = {
    position: () => position(item.el, exp, act, k, e, a),
    size: () => (oneLine ? { ...lengths([e.h], [a.h], [allow(TOLERANCE.size, TOLERANCE.sizeShare, e.h)], fmtPx), expected: fmtSize([e.w, e.h]), actual: fmtSize([a.w, a.h]) } : lengths([e.w, e.h], [a.w, a.h], [allow(TOLERANCE.size, TOLERANCE.sizeShare, e.w), allow(TOLERANCE.size, TOLERANCE.sizeShare, e.h)], fmtSize)),
    drawn: () => drawn(e, a),
    fill: () => fill(e, a),
    stroke: () => stroke(e, a),
    radius: () => lengths([pill(e)], [pill(a)], [allow(TOLERANCE.radius, TOLERANCE.radiusShare, pill(e))], fmtPx),
    shadow: () => shadow(e.shadow, a.shadow),
    opacity: () => alpha(e.opacity, a.opacity),
    words: () => same(e.text, a.text ?? "(none)"),
    font: () => font(e, a),
    "font-size": () => lengths([e.size], [a.size], [TOLERANCE.fontSize], fmtPx),
    "line-height": () => lengths([e.lineHeight], [a.lineHeight], [allow(TOLERANCE.lineHeight, TOLERANCE.lineHeightShare, e.lineHeight)], fmtPx),
    "letter-spacing": () => lengths([e.letterSpacing ?? 0], [a.letterSpacing ?? 0], [TOLERANCE.letterSpacing], fmtPx),
    color: () => colour(e.color, a.color),
  };

  const run = COMPARE[item.prop];
  return run ? run() : { result: "unmeasured", expected: "", actual: "", note: `unknown property ${item.prop}` };
}

/**
 * Lengths, each within its tolerance: pass; else fail. There is no borderline band: the tolerances are the
 * line between noise and a defect.
 *
 * @param {number[]} want
 * @param {number[]} got
 * @param {number | number[]} tolerance one for all, or one per value
 * @param {(values: number[]) => string} format
 * @returns {{ result: string, expected: string, actual: string, note?: string }}
 * @example
 * lengths([13], [14.3], [0.5], fmtPx); // { result: "fail", note: "1.3 px off, tolerance 0.5" … }
 */
export function lengths(want, got, tolerance, format) {
  const tol = (index) => (Array.isArray(tolerance) ? tolerance[index] : tolerance);
  const bad = got.some((value) => !Number.isFinite(value));
  const off = bad ? [] : want.map((value, index) => Math.abs(value - got[index]));
  const over = off.findIndex((value, index) => value > tol(index) + 1e-6);
  const base = { expected: format(want), actual: bad ? "(none)" : format(got) };

  if (bad) return { result: "fail", ...base, note: "no value" };
  if (over === -1) return { result: "pass", ...base };
  return { result: "fail", ...base, note: `${round(off[over])} px off, tolerance ${round(tol(over))}` };
}

/**
 * A position, per axis: the gap from the element's edge nearest to an edge of its container or of a sibling
 * (in the prototype), against the gap between the same two edges in the build, within max(3 px, 4 % of the gap).
 * A local shift moves that gap by its full amount; a layout stretched to another device moves it a little.
 *
 * @param {string} id
 * @param {Record<string, any>} exp
 * @param {Record<string, any>} act
 * @param {number} k
 * @param {Record<string, any>} e
 * @param {Record<string, any>} a
 */
function position(id, exp, act, k, e, a) {
  const family = containers(exp);
  const parent = family[id];
  const refs = Object.keys(family).filter((other) => other !== id && (other === parent || family[other] === parent) && family[other] !== id && act[other]?.present);
  const boxes = refs.map((other) => [exp[other], toPrototypePx(act[other], k)]);
  if (!parent) boxes.push([{ x: 0, y: 0, w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY }, { x: 0, y: 0, w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY }]);

  const base = { expected: fmtPair([e.x, e.y]), actual: fmtPair([a.x, a.y]) };
  for (const [axis, dim] of [["x", "w"], ["y", "h"]]) {
    const gaps = [];
    for (const [rp, rb] of boxes) {
      const pairs = [[e[axis], a[axis]], [e[axis] + e[dim], a[axis] + a[dim]]];
      const edges = [[rp[axis], rb[axis]], [rp[axis] + rp[dim], rb[axis] + rb[dim]]];
      for (const [pe, pa] of pairs) for (const [qe, qa] of edges) if (Number.isFinite(qe)) gaps.push([pe - qe, pa - qa]);
    }
    if (gaps.length === 0) continue;
    gaps.sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]));
    const [want, got] = gaps[0];
    const tolerance = allow(TOLERANCE.gap, TOLERANCE.gapShare, want);
    if (Math.abs(want - got) > tolerance + 1e-6) return { result: "fail", ...base, note: `${axis}: the gap to the nearest edge is ${round(got)} px, the prototype's ${round(want)} (tolerance ${round(tolerance)})` };
  }
  return { result: "pass", ...base };
}

const CONTAINERS = new WeakMap();

/**
 * Each present element's container in the prototype: the smallest other element that holds its box.
 *
 * @param {Record<string, any>} exp
 * @returns {Record<string, string | undefined>}
 */
function containers(exp) {
  if (CONTAINERS.has(exp)) return CONTAINERS.get(exp);
  const ids = Object.keys(exp).filter((id) => id !== PAGE && exp[id]?.present && Number.isFinite(exp[id].w));
  const area = (id) => exp[id].w * exp[id].h;
  const holds = (p, b) => p.x <= b.x + 0.5 && p.y <= b.y + 0.5 && p.x + p.w >= b.x + b.w - 0.5 && p.y + p.h >= b.y + b.h - 0.5;
  const out = {};
  for (const id of ids) {
    const best = ids.filter((other) => other !== id && area(other) > area(id) && holds(exp[other], exp[id])).sort((p, q) => area(p) - area(q))[0];
    out[id] = best;
  }
  CONTAINERS.set(exp, out);
  return out;
}

// --- appearance --------------------------------------------------------------

/**
 * What paints the element: the set of image, fill, gradient and stroke. A shape drawn as a sprite (or the
 * other way round) is a fail even when the boxes agree.
 *
 * @param {{ drawn?: string[], image?: string }} e
 * @param {{ drawn?: string[], image?: string }} a
 */
function drawn(e, a) {
  const want = [...(e.drawn ?? [])].sort().join("+") || "nothing";
  const got = [...(a.drawn ?? [])].sort().join("+") || "nothing";
  const image = a.image && (a.drawn ?? []).includes("image") ? ` (${a.image})` : "";

  return want === got ? { result: "pass", expected: want, actual: got + image } : { result: "fail", expected: want, actual: got + image, note: `drawn differently: the prototype paints ${want}, the build ${got}${image}` };
}

/** @param {{ fill?: string, gradient?: string | null }} e @param {{ fill?: string, gradient?: string | null }} a */
function fill(e, a) {
  if (Boolean(e.gradient) !== Boolean(a.gradient)) return { result: "fail", expected: e.gradient ? "gradient" : e.fill ?? "none", actual: a.gradient ? "gradient" : a.fill ?? "none", note: "one side is a gradient" };
  if (e.gradient) return same(normalizeGradient(e.gradient), normalizeGradient(a.gradient));

  return colour(e.fill ?? "rgba(0, 0, 0, 0)", a.fill ?? "rgba(0, 0, 0, 0)");
}

/** @param {{ stroke?: { width: number, color: string } | null }} e @param {{ stroke?: { width: number, color: string } | null }} a */
function stroke(e, a) {
  const want = e.stroke && e.stroke.width > 0 ? e.stroke : undefined;
  const got = a.stroke && a.stroke.width > 0 ? a.stroke : undefined;
  if (!want && !got) return { result: "pass", expected: "none", actual: "none" };
  if (!want || !got) return { result: "fail", expected: fmtStroke(want), actual: fmtStroke(got), note: want ? "the build has no stroke" : "the build has a stroke the prototype lacks" };

  const width = lengths([want.width], [got.width], [TOLERANCE.stroke], fmtPx);
  const col = colour(want.color, got.color);
  const result = [width.result, col.result].includes("fail") ? "fail" : [width.result, col.result].includes("open") ? "open" : "pass";

  return { result, expected: fmtStroke(want), actual: fmtStroke(got), note: [width.note, col.note].filter(Boolean).join("; ") || undefined };
}

/**
 * Two colours: every channel within 1 of 255 and alpha within 0.02.
 *
 * @param {string | undefined} want
 * @param {string | undefined} got
 */
export function colour(want, got) {
  const p = parseColour(want);
  const q = parseColour(got);
  if (!p || !q) return same(String(want ?? "none"), String(got ?? "none"));

  const channels = p.slice(0, 3).every((value, index) => Math.abs(value - q[index]) <= TOLERANCE.channel);
  const opaque = Math.abs(p[3] - q[3]) <= TOLERANCE.alpha;
  const both = p[3] === 0 && q[3] === 0;

  return both || (channels && opaque) ? { result: "pass", expected: fmtColour(p), actual: fmtColour(q) } : { result: "fail", expected: fmtColour(p), actual: fmtColour(q) };
}

/** @param {number | undefined} want @param {number | undefined} got */
function alpha(want, got) {
  const p = Number(want ?? 1);
  const q = Number(got ?? 1);
  const diff = Math.abs(p - q);
  const base = { expected: String(round(p)), actual: String(round(q)) };

  return diff <= TOLERANCE.alpha + 1e-6 ? { result: "pass", ...base } : { result: "fail", ...base };
}

/** @param {string | undefined} want @param {string | undefined} got */
function shadow(want, got) {
  const p = shadowLayers(want);
  const q = shadowLayers(got);
  const fmt = (layers) => (layers.length === 0 ? "none" : layers.map((layer) => `${layer.inset ? "inset " : ""}${layer.lengths.map(round).join(" ")} ${fmtColour(layer.colour)}`).join(", "));
  const base = { expected: fmt(p), actual: fmt(q) };
  if (p.length !== q.length) return { result: "fail", ...base, note: `${p.length} shadow layer(s) in the prototype, ${q.length} in the build` };

  let worst = "pass";
  for (let index = 0; index < p.length; index++) {
    const len = lengths(p[index].lengths, q[index].lengths, [TOLERANCE.shadow, TOLERANCE.shadow, TOLERANCE.shadow, TOLERANCE.shadow], fmtPx).result;
    const col = colour(fmtColour(p[index].colour), fmtColour(q[index].colour)).result;
    const inset = p[index].inset === q[index].inset ? "pass" : "fail";
    worst = [worst, len, col, inset].includes("fail") ? "fail" : [worst, len, col].includes("open") ? "open" : "pass";
  }

  return { result: worst, ...base };
}

/** @param {{ family?: string, weight?: string | number, fontLoaded?: boolean }} e @param {{ family?: string, weight?: string | number, fontLoaded?: boolean }} a */
function font(e, a) {
  const want = `${e.family} ${e.weight}`;
  const got = `${a.family} ${a.weight}${a.fontLoaded === false ? " (fallback!)" : ""}`;
  const ok = sameFamily(e.family, a.family) && String(e.weight) === String(a.weight) && a.fontLoaded !== false;

  return { result: ok ? "pass" : "fail", expected: want, actual: got, note: a.fontLoaded === false ? "the face did not load: a fallback rendered" : undefined };
}

/** @param {string | undefined} want @param {string | undefined} got */
function same(want, got) {
  return { result: want === got ? "pass" : "fail", expected: String(want ?? ""), actual: String(got ?? "") };
}

// --- the page ----------------------------------------------------------------

/**
 * The adaptation rules on boxes: no horizontal scroll, no clipped text that the prototype does not clip, no
 * overlap between two elements that do not overlap in the prototype, everything inside the safe area.
 *
 * @param {string} prop
 * @param {Record<string, any>} exp
 * @param {Record<string, any>} act
 * @param {number} k
 * @param {{ h: number, safe?: { top: number, bottom: number } }} size
 */
function comparePage(prop, exp, act, k, size) {
  const page = act[PAGE] ?? {};
  const ids = Object.keys(exp).filter((id) => id !== PAGE && exp[id].present && act[id]?.present);
  const boxes = Object.fromEntries(ids.map((id) => [id, toPrototypePx(act[id], k)]));
  const verdict = (list, what) => (list.length === 0 ? { result: "pass", expected: "none", actual: "none" } : { result: "fail", expected: "none", actual: list.slice(0, 8).join(", ") + (list.length > 8 ? ` … ${list.length - 8} more` : ""), note: what });

  if (prop === "no-horizontal-scroll") {
    const wide = Number(page.scrollW ?? 0) > Number(page.innerW ?? Number.POSITIVE_INFINITY) + 1;
    return wide ? { result: "fail", expected: "no scroll", actual: `${page.scrollW} > ${page.innerW}` } : { result: "pass", expected: "no scroll", actual: "no scroll" };
  }

  if (prop === "text-not-clipped") {
    const before = new Set(exp[PAGE]?.clipped ?? []);
    return verdict((page.clipped ?? []).filter((id) => !before.has(id)), "text clipped on the build");
  }

  if (prop === "no-new-overlaps") {
    const found = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [p, q] = [ids[i], ids[j]];
        if (!overlap(exp[p], exp[q]) && overlap(boxes[p], boxes[q]) && !inside(boxes[p], boxes[q]) && !inside(boxes[q], boxes[p])) found.push(`${p}×${q}`);
      }
    }
    return verdict(found, "elements overlap that do not in the prototype");
  }

  if (prop === "inside-safe-area") {
    const top = size.safe?.top ?? 0;
    const bottom = size.h - (size.safe?.bottom ?? 0);
    const out = ids.filter((id) => boxes[id].h < size.h - 2 && (boxes[id].y < top - 1 || boxes[id].y + boxes[id].h > bottom + 1) && exp[id].y >= top - 1 && exp[id].y + exp[id].h <= bottom + 1);
    return verdict(out, "outside the safe area");
  }

  return { result: "unmeasured", expected: "", actual: "", note: `unknown page rule ${prop}` };
}

// --- deviations and the summary ---------------------------------------------

/**
 * A row a deviation names: accepted → `decision`; pending → `open` (waiting on the person); rejected → as measured.
 *
 * @param {any} row
 * @param {any[]} deviations
 */
export function applyDeviation(row, deviations) {
  if (row.result === "pass" || row.result === "covered") return row;

  const match = deviations.find((entry) => (entry.element === row.el || (Array.isArray(entry.element) && entry.element.includes(row.el))) && (!entry.prop || entry.prop === row.prop || (Array.isArray(entry.prop) && entry.prop.includes(row.prop))) && (!entry.sizes || entry.sizes.includes(row.size)) && (!entry.states || entry.states.includes(row.state)));
  if (!match) return row;

  const decision = match.decision?.answer;
  if (decision === "accept") return { ...row, result: "decision", deviation: match.id, note: `by decision ${match.id}: ${match.decision.words ?? match.proposal ?? ""}`.trim() };
  if (!decision) return { ...row, result: "open", deviation: match.id, note: `waiting on the person: deviation ${match.id} (${match.kind}) — ${match.proposal ?? match.reason ?? ""}`.trim() };

  return { ...row, deviation: match.id };
}

/**
 * The counts and the verdict. PASS needs every row a pass or a decision, every target size measured, and no
 * deviation waiting on the person.
 *
 * @param {any[]} rows
 * @param {any} spec
 * @param {any} actual
 * @param {any[]} deviations
 */
export function summarize(rows, spec, actual, deviations) {
  const count = (result) => rows.filter((row) => row.result === result).length;
  const pending = deviations.filter((entry) => !entry.decision?.answer);
  const missingSizes = spec.sizes.filter((size) => size.target && !actual.values?.[size.id]).map((size) => size.id);
  const summary = { rows: rows.length, pass: count("pass"), decision: count("decision"), open: count("open"), fail: count("fail"), covered: count("covered"), unmeasured: count("unmeasured"), pendingDeviations: pending.length, missingSizes };
  const pass = summary.fail === 0 && summary.open === 0 && summary.unmeasured === 0 && pending.length === 0 && missingSizes.length === 0;

  return { verdict: pass ? "PASS" : "FAIL", ...summary };
}

// --- values ------------------------------------------------------------------

/**
 * The build's element in prototype px: every length divided by the factor.
 *
 * @param {Record<string, any>} element
 * @param {number} k
 */
export function toPrototypePx(element, k) {
  if (k === 1) return element;

  const scaled = { ...element };
  for (const key of ["x", "y", "w", "h", "radius", "size", "lineHeight", "letterSpacing"]) {
    if (typeof element[key] === "number") scaled[key] = element[key] / k;
  }
  if (element.stroke?.width !== undefined) scaled.stroke = { ...element.stroke, width: element.stroke.width / k };
  if (element.shadow && element.shadow !== "none") scaled.shadow = scaleShadow(element.shadow, 1 / k);

  return scaled;
}

/**
 * Shadow layers as numbers: `{ inset, lengths: [x, y, blur, spread], colour: [r, g, b, a] }`, sorted.
 *
 * @param {string | undefined} text a CSS `box-shadow`
 */
export function shadowLayers(text) {
  if (!text || text === "none") return [];

  return splitTop(text)
    .map((layer) => {
      const col = /rgba?\([^)]*\)|#[\da-f]{3,8}\b/i.exec(layer)?.[0] ?? "rgb(0, 0, 0)";
      const rest = layer.replace(col, " ");
      const len = (rest.match(/-?\d*\.?\d+(?=px|\b)/g) ?? []).map(Number);
      while (len.length < 4) len.push(0);
      return { inset: /\binset\b/.test(layer), lengths: len.slice(0, 4), colour: parseColour(col) ?? [0, 0, 0, 1] };
    })
    .sort((p, q) => Number(p.inset) - Number(q.inset) || p.lengths[1] - q.lengths[1] || p.lengths[0] - q.lengths[0]);
}

/**
 * @param {string} text
 * @param {number} scale
 */
function scaleShadow(text, scale) {
  return shadowLayers(text)
    .map((layer) => `${layer.inset ? "inset " : ""}${layer.lengths.map((value) => `${value * scale}px`).join(" ")} ${fmtColour(layer.colour)}`)
    .join(", ");
}

/**
 * `rgb()`, `rgba()`, `#rgb`, `#rrggbb`, `#rrggbbaa`, `transparent`, or a 0xRRGGBB number → `[r, g, b, a]`.
 *
 * @param {unknown} value
 * @returns {number[] | undefined}
 * @example
 * parseColour("rgba(251, 243, 226, 0.3)"); // [251, 243, 226, 0.3]
 */
export function parseColour(value) {
  if (typeof value === "number") return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "transparent" || text === "none" || text === "") return [0, 0, 0, 0];

  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map((part) => (part.endsWith("%") ? Number.parseFloat(part) / 100 : Number(part)));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }

  const hex = /^#([\da-f]{3,8})$/.exec(text)?.[1];
  if (!hex) return undefined;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const n = (i) => Number.parseInt(full.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), full.length === 8 ? round(n(6) / 255) : 1];
}

/** @param {number[] | undefined} c */
function fmtColour(c) {
  if (!c) return "none";
  return c[3] === 1 ? `rgb(${c.slice(0, 3).map(Math.round).join(", ")})` : `rgba(${c.slice(0, 3).map(Math.round).join(", ")}, ${round(c[3])})`;
}

/** @param {{ width: number, color: string } | undefined} s */
function fmtStroke(s) {
  return s ? `${round(s.width)}px ${fmtColour(parseColour(s.color))}` : "none";
}

/**
 * A gradient in one canonical form: the angle in degrees (180 when left out, `to right` 90 …) and every stop
 * with its colour and its position, so `linear-gradient(a 0%, b 100%)` equals `linear-gradient(180deg, a, b)`.
 *
 * @param {string | undefined} text
 * @returns {string}
 * @example
 * normalizeGradient("linear-gradient(rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%)"); // "linear 180deg: rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%"
 */
export function normalizeGradient(text) {
  const match = /^\s*(repeating-)?(linear|radial|conic)-gradient\((.*)\)\s*$/s.exec(String(text ?? ""));
  if (!match) return String(text ?? "").replace(/\s+/g, " ").trim();

  const args = splitTop(match[3]);
  const TO = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270, "to top right": 45, "to right top": 45, "to bottom right": 135, "to right bottom": 135, "to bottom left": 225, "to left bottom": 225, "to top left": 315, "to left top": 315 };
  let head = match[2] === "linear" ? "180deg" : "";
  if (/^-?[\d.]+(deg|turn|rad)$/.test(args[0]) || /^to /.test(args[0]) || (match[2] !== "linear" && !parseColour(args[0].split(/\s+(?=[\d.-]+%?$)/)[0]))) {
    const first = args.shift();
    const deg = /^(-?[\d.]+)deg$/.exec(first)?.[1] ?? (/^(-?[\d.]+)turn$/.exec(first) ? Number(/^(-?[\d.]+)turn$/.exec(first)[1]) * 360 : undefined);
    head = deg !== undefined ? `${Number(deg)}deg` : TO[first] !== undefined ? `${TO[first]}deg` : first;
  }

  const stops = args.map((arg) => {
    const col = /rgba?\([^)]*\)|#[\da-f]{3,8}\b|transparent/i.exec(arg)?.[0] ?? arg;
    const pos = /(-?[\d.]+)%/.exec(arg.replace(col, ""))?.[1];
    return { col: fmtColour(parseColour(col)), pos: pos === undefined ? undefined : Number(pos) };
  });
  stops.forEach((stop, index) => {
    if (stop.pos === undefined) stop.pos = stops.length === 1 ? 0 : Math.round((10000 * index) / (stops.length - 1)) / 100;
  });

  return `${match[1] ?? ""}${match[2]} ${head}: ${stops.map((stop) => `${stop.col} ${stop.pos}%`).join(", ")}`.replace(" :", ":");
}

/** A radius never larger than half the shorter side: a pill is a pill whatever radius drew it. */
function pill(e) {
  return Math.min(Number(e.radius ?? 0), Math.min(e.w, e.h) / 2);
}

/** @param {string | undefined} p @param {string | undefined} q */
function sameFamily(p, q) {
  const clean = (name) => String(name ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
  return clean(p) === clean(q);
}

/** @param {any} p @param {any} q */
function overlap(p, q) {
  return Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 1 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 1;
}

/** @param {any} p @param {any} q */
function inside(p, q) {
  return p.x >= q.x - 1 && p.y >= q.y - 1 && p.x + p.w <= q.x + q.w + 1 && p.y + p.h <= q.y + q.h + 1;
}

/** Split on commas that are not inside parentheses. @param {string} text */
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")") depth--;
    else if (text[index] === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** @param {number} value */
function round(value) {
  return Math.round(value * 100) / 100;
}

/** @param {number[]} v */
export function fmtPx(v) {
  return `${round(v[0])}px`;
}

/** @param {number[]} v */
function fmtPair(v) {
  return `${round(v[0])}, ${round(v[1])}`;
}

/** @param {number[]} v */
function fmtSize(v) {
  return `${round(v[0])}×${round(v[1])}`;
}
