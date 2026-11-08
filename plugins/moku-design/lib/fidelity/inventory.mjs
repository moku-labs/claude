/**
 * The fixed inventory of the design check: which rows exist, decided once, at capture, from the prototype.
 *
 * A row is one element × one property × one size × one state. The prototype decides which elements exist and
 * what kind each one is (text or not); the spec decides the sizes and the states. After capture the rows never
 * change, so every run of the check measures the same rows and the counts of two runs compare.
 *
 * Files under `.planning/design/{slug}/`:
 * - `spec.json` (`moku-fidelity/spec@1`): sizes, states, conversion, element selectors. Hand-written or derived.
 * - `check/expected.json` (`moku-fidelity/expected@1`): the spec, the inventory and the prototype's values.
 */

export const SPEC_SCHEMA = "moku-fidelity/spec@1";
export const EXPECTED_SCHEMA = "moku-fidelity/expected@1";
export const ACTUAL_SCHEMA = "moku-fidelity/actual@1";
export const RESULT_SCHEMA = "moku-fidelity/result@1";

/** Properties every element gets a row for. `drawn` is what paints it: image, fill, gradient, stroke. */
export const BOX_PROPS = ["present", "position", "size", "drawn", "fill", "stroke", "radius", "shadow", "opacity"];

/** Properties a text element gets on top of the box ones. */
export const TEXT_PROPS = ["words", "font", "font-size", "line-height", "letter-spacing", "color"];

/** Page rows per size and state: the adaptation rules, checked on boxes. */
export const PAGE_PROPS = ["no-horizontal-scroll", "text-not-clipped", "no-new-overlaps", "inside-safe-area"];

/** The pseudo element that holds the page rows. */
export const PAGE = "@page";

/**
 * A size id from its width and height.
 *
 * @param {number} w
 * @param {number} h
 * @returns {string}
 * @example
 * sizeId(390, 844); // "390x844"
 */
export function sizeId(w, h) {
  return `${w}x${h}`;
}

/**
 * Parse `390x844,768x1024` into sizes, every one a target.
 *
 * @param {string} text
 * @returns {{ id: string, w: number, h: number, target: boolean }[]}
 * @example
 * parseSizes("390x844"); // [{ id: "390x844", w: 390, h: 844, target: true }]
 */
export function parseSizes(text) {
  return String(text)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(\d+)x(\d+)$/.exec(part);
      if (!match) throw new Error(`a size is WxH, not "${part}"`);

      return { id: part, w: Number(match[1]), h: Number(match[2]), target: true };
    });
}

/**
 * A spec with every default filled in, so the rest of the check reads one shape.
 *
 * @param {Record<string, any>} spec as read from `spec.json` or built from flags
 * @returns {{ schema: string, prototype: string, conversion: { unit: "px" | "game", reference?: number }, sizes: any[], states: any[], elements?: Record<string, any> }}
 */
export function normalizeSpec(spec) {
  const sizes = (spec.sizes ?? []).map((size) => ({ target: true, ...size, id: size.id ?? sizeId(size.w, size.h) }));
  if (sizes.length === 0) throw new Error("the spec names no size: give --sizes 390x844,... or write sizes into spec.json");

  const states = (spec.states?.length ? spec.states : [{ id: "default", query: "" }]).map((state) => ({ query: "", ...state }));
  const conversion = spec.conversion?.unit === "game" ? { unit: "game", reference: Number(spec.conversion.reference ?? 1080) } : { unit: "px" };

  return { ...spec, schema: SPEC_SCHEMA, prototype: spec.prototype ?? "index.html", conversion, sizes, states };
}

/**
 * How many target units one prototype px is at a size: 1 on the web, `reference / width` in a game.
 *
 * @param {{ unit: string, reference?: number }} conversion
 * @param {{ w: number }} size
 * @returns {number}
 * @example
 * factor({ unit: "game", reference: 1080 }, { w: 390 }); // 2.769…
 */
export function factor(conversion, size) {
  return conversion.unit === "game" ? Number(conversion.reference ?? 1080) / size.w : 1;
}

/**
 * The fixed rows, from the prototype's values. An element absent from a state keeps one row, `present`,
 * that expects it absent; a present one gets the box rows and, when it holds words, the text rows.
 *
 * @param {ReturnType<typeof normalizeSpec>} spec
 * @param {Record<string, Record<string, Record<string, any>>>} values size id → state id → element id → measurement
 * @returns {{ row: string, el: string, prop: string, size: string, state: string }[]}
 */
export function buildInventory(spec, values) {
  const rows = [];
  for (const size of spec.sizes) {
    for (const state of spec.states) {
      const measured = values[size.id]?.[state.id] ?? {};
      const ids = Object.keys(measured).filter((id) => id !== PAGE).sort();

      for (const id of ids) {
        const element = measured[id];
        const props = !element.present ? ["present"] : element.text === undefined ? BOX_PROPS : [...BOX_PROPS, ...TEXT_PROPS];
        for (const prop of props) rows.push(makeRow(id, prop, size.id, state.id));
      }

      for (const prop of PAGE_PROPS) {
        if (prop !== "inside-safe-area" || size.safe) rows.push(makeRow(PAGE, prop, size.id, state.id));
      }
    }
  }

  return rows;
}

/**
 * @param {string} el
 * @param {string} prop
 * @param {string} size
 * @param {string} state
 */
function makeRow(el, prop, size, state) {
  return { row: `${el}|${prop}|${size}|${state}`, el, prop, size, state };
}
