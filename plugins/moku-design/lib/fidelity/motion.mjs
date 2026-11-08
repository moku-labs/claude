/**
 * Motion rows of the design check: the motion table of the approved prototype (its `moku-design` block, §2b
 * of the design context) against what the build plays.
 *
 * The table is kept in `spec.json` under `animations`, one entry per row: `id`, `element`, `state` and the
 * eight columns. Capture copies it from the prototype when `spec.json` has none. Each row × column is one
 * inventory row, element `motion:<id>`, size `all`. A design with no motion table gets one row,
 * `motion:table`, that fails: the build does not invent motion, and "no motion on purpose" is a deviation the
 * person decides, never an empty table.
 *
 * The build side is `motion.json` beside `actual.json` (`moku-fidelity motion`): what was measured on the
 * build, per row id. Web: `document.getAnimations()` and computed transitions, paused at control points.
 * Game: the engine's own time stepped frame by frame. A row nobody measured is `unmeasured`.
 */

import { COLUMNS, extractContract } from "../proto-check/contract.mjs";

export const MOTION_SCHEMA = "moku-fidelity/motion@1";

/** The element prefix of motion rows. */
export const MOTION = "motion:";

/** The pseudo element of the "a motion table exists" row. */
export const MOTION_TABLE = "motion:table";

/** Timing tolerance in ms: 16 on the web, one frame of a 60 fps fixed step in a game. */
export const MOTION_TOLERANCE = { webMs: 16, gameMs: 1000 / 60, px: 1, unitless: 0.01, deg: 1, curve: 0.001 };

/**
 * The motion table of a prototype's `moku-design` block, as `spec.json` keeps it.
 *
 * @param {string} html - The prototype.
 * @returns {any[] | undefined} The rows, or undefined when the prototype has no block.
 */
export function motionFromPrototype(html) {
  const { contract } = extractContract(html);
  if (!contract || !Array.isArray(contract.motion)) return undefined;

  return contract.motion.map((row) => ({
    id: row.id,
    element: row.element,
    state: row.state || "default",
    ...Object.fromEntries(COLUMNS.map((column) => [column, row[column] ?? ""]))
  }));
}

/**
 * The fixed motion rows: each table row × column, or the single failing `motion:table` row.
 *
 * @param {{ animations?: any[] }} spec
 * @returns {{ row: string, el: string, prop: string, size: string, state: string, motion?: string, target?: string }[]}
 */
export function buildMotionInventory(spec) {
  const rows = spec.animations ?? [];
  if (rows.length === 0) return [{ row: `${MOTION_TABLE}|present|all|all`, el: MOTION_TABLE, prop: "present", size: "all", state: "all" }];

  return rows.flatMap((entry) =>
    COLUMNS.map((column) => ({ row: `${MOTION}${entry.id}|${column}|all|${entry.state}`, el: `${MOTION}${entry.id}`, prop: column, size: "all", state: entry.state, motion: entry.id, target: entry.element }))
  );
}

/**
 * One motion row against what the build plays.
 *
 * @param {{ el: string, prop: string, motion?: string }} item
 * @param {{ animations?: any[], conversion: { unit: string } }} spec
 * @param {Record<string, Record<string, string>> | undefined} measured - `motion.json` rows: id → column → value.
 * @returns {{ result: string, expected: string, actual: string, note?: string }}
 */
export function compareMotion(item, spec, measured) {
  if (item.el === MOTION_TABLE) {
    return { result: "fail", expected: "a motion table", actual: "none", note: "no motion table: §2b of the design context and the prototype's moku-design block are empty; the design station writes it" };
  }

  const want = spec.animations?.find((entry) => entry.id === item.motion)?.[item.prop];
  const got = measured?.[item.motion]?.[item.prop];
  if (got === undefined) return { result: "unmeasured", expected: String(want ?? ""), actual: "", note: "not measured on the build: record it with `moku-fidelity motion`" };

  const same = sameMotionValue(item.prop, String(want ?? ""), String(got), spec.conversion.unit === "game");
  return { result: same ? "pass" : "fail", expected: String(want ?? ""), actual: String(got) };
}

/**
 * Whether two cells of one column agree, by the column's tolerance.
 *
 * @param {string} column - One of the eight columns.
 * @param {string} want - The prototype's cell.
 * @param {string} got - The build's cell.
 * @param {boolean} game - A game: timing is judged by one frame of the fixed step.
 * @returns {boolean}
 */
export function sameMotionValue(column, want, got, game = false) {
  if (column === "duration" || column === "delay") {
    const a = ms(want);
    const b = ms(got);
    if (a === undefined || b === undefined) return words(want) === words(got);
    return Math.abs(a - b) <= (game ? MOTION_TOLERANCE.gameMs : MOTION_TOLERANCE.webMs) + 1e-9;
  }
  if (column === "curve") return sameCurve(want, got);
  if (column === "keys") return sameKeys(want, got);
  return words(want) === words(got);
}

/**
 * Milliseconds of a timing cell: `320ms`, `0.4s`, `320`; the first value of a range.
 *
 * @param {string} text
 * @returns {number | undefined}
 */
export function ms(text) {
  const match = /(-?\d+(?:\.\d+)?)\s*(ms|s)?\b/i.exec(text);
  if (!match) return undefined;
  return Number(match[1]) * (match[2]?.toLowerCase() === "s" ? 1000 : 1);
}

/**
 * The same curve: the same name, or the same numbers of a `cubic-bezier`, `steps` or spring.
 *
 * @param {string} want
 * @param {string} got
 * @returns {boolean}
 */
export function sameCurve(want, got) {
  const a = numbers(want);
  const b = numbers(got);
  const name = (text) => words(text).replace(/\(.*$/, "");
  if (name(want) !== name(got) || a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value.n - b[index].n) <= MOTION_TOLERANCE.curve);
}

/**
 * The same key values: the same numbers in the same order, px within 1, degrees within 1, unitless (opacity,
 * scale) within 0.01. Cells without numbers compare as words.
 *
 * @param {string} want
 * @param {string} got
 * @returns {boolean}
 */
export function sameKeys(want, got) {
  const a = numbers(want);
  const b = numbers(got);
  if (a.length === 0 || a.length !== b.length) return words(want) === words(got);

  return a.every((value, index) => {
    const other = b[index];
    if (value.unit !== other.unit) return false;
    const tolerance = value.unit === "px" ? MOTION_TOLERANCE.px : value.unit === "deg" ? MOTION_TOLERANCE.deg : value.unit === "ms" || value.unit === "s" ? MOTION_TOLERANCE.webMs : MOTION_TOLERANCE.unitless;
    return Math.abs(value.n - other.n) <= tolerance + 1e-9;
  });
}

/**
 * @param {string} text
 * @returns {{ n: number, unit: string }[]}
 */
function numbers(text) {
  return [...String(text).matchAll(/(-?\d*\.?\d+)\s*(px|deg|ms|s|%)?/gi)].map((match) => ({ n: Number(match[1]), unit: (match[2] ?? "").toLowerCase() }));
}

/**
 * A cell as words: case, spaces and closing punctuation do not count.
 *
 * @param {string} text
 * @returns {string}
 */
function words(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").replace(/\s*([(),→>])\s*/g, "$1").replace(/[.;]+$/, "").trim();
}

/**
 * The expression for the browser pane that lists what a web build plays now: paste it with `javascript_tool`
 * after starting the motion, then write the values into `motion.json`.
 */
export const MOTION_PROBE = `(() => document.getAnimations().map((a) => {
  const t = a.effect?.getTiming?.() ?? {};
  const el = a.effect?.target;
  return { name: a.animationName ?? a.transitionProperty ?? a.id ?? "", target: el ? (el.dataset?.check ?? el.dataset?.motion ?? el.id ?? el.tagName.toLowerCase()) : "", duration: t.duration, delay: t.delay, curve: t.easing, keyframes: a.effect?.getKeyframes?.() ?? [] };
}))()`;
