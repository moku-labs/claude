/**
 * The design contract of a concept prototype: the JSON block every concept carries in
 * `<script type="application/json" id="moku-design">`, and the static check of it.
 *
 * The block holds the motion table (eight columns per row), the states the prototype opens by `?state=`,
 * the target sizes it opens by `?vp=`, the adaptation rules between them, and the concept's motion
 * character. The rules are in `skills/design/references/design-motion.md`.
 */

/** The eight columns of a motion row, in table order. `element` and `kind` sit beside them. */
export const COLUMNS = ["trigger", "duration", "delay", "curve", "keys", "sequence", "sound", "reduced"];

/** The events every concept covers with a row, or names in `noMotion` with a reason. */
export const REQUIRED_EVENTS = {
  game: [
    "screen-in",
    "screen-out",
    "popup-in",
    "popup-out",
    "transition",
    "press",
    "disabled",
    "reward",
    "win",
    "error",
    "particles",
    "idle",
    "counter",
    "loading"
  ],
  web: ["page-transition", "state-change", "reveal", "hover", "focus", "press", "menu", "modal", "loading"]
};

/** The fewest target sizes a concept declares, per medium. */
export const MIN_VIEWPORTS = { game: 2, web: 3 };

const PLACEHOLDER = /^(?:|-|—|–|\?|tbd|todo|n\/a|\.\.\.|…)$/i;
const SIZE = /^(\d{2,5})x(\d{2,5})$/;

/**
 * Finds the contract block in the prototype's HTML and parses it.
 *
 * @param {string} html - The concept file.
 * @returns {{ contract?: any, error?: string }} The parsed block, or why there is none.
 */
export function extractContract(html) {
  const match = /<script\b[^>]*\bid=["']moku-design["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return { error: 'no <script type="application/json" id="moku-design"> block' };

  try {
    return { contract: JSON.parse(match[1]) };
  } catch (error) {
    return { error: `the moku-design block is not valid JSON: ${error.message}` };
  }
}

/**
 * True when a table cell holds a real value. `none` is a value: it says on purpose that there is nothing.
 *
 * @param {unknown} value - The cell.
 * @returns {boolean}
 */
export function filled(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return !PLACEHOLDER.test(value.trim());
}

/**
 * Parses a `?vp=` size such as `390x844`.
 *
 * @param {string} size - The size.
 * @returns {{ width: number, height: number } | undefined}
 */
export function parseSize(size) {
  const match = SIZE.exec(String(size ?? "").trim());
  return match ? { width: Number(match[1]), height: Number(match[2]) } : undefined;
}

/**
 * Checks the contract without a browser: every motion row has all eight columns, every required event is
 * covered or declared still, the states and sizes are listed, the adaptation rules and the motion character
 * are written.
 *
 * @param {any} contract - The parsed block.
 * @param {{ medium?: string }} [options] - The medium, when the block does not name it.
 * @returns {{ medium: string, rows: number, columns: Record<string, number>, fullRows: number,
 *   events: { required: number, covered: number, missing: string[] }, states: number, viewports: number,
 *   findings: string[] }}
 */
export function checkContract(contract, options = {}) {
  const findings = [];
  const medium = contract.medium ?? options.medium ?? "web";
  const rows = Array.isArray(contract.motion) ? contract.motion : [];

  if (!REQUIRED_EVENTS[medium]) findings.push(`medium "${medium}" is not game or web`);
  if (!filled(contract.motionCharacter)) findings.push("motionCharacter is empty: the concept's motion character is part of its art direction");
  if (!filled(contract.signature)) findings.push("signature is empty: name the motion row of the signature moment");
  if (filled(contract.signature) && !rows.some((row) => row.id === contract.signature)) {
    findings.push(`signature "${contract.signature}" is not the id of a motion row`);
  }

  // The table: eight columns in every row
  const columns = Object.fromEntries(COLUMNS.map((name) => [name, rows.filter((row) => filled(row[name])).length]));
  const fullRows = rows.filter((row) => COLUMNS.every((name) => filled(row[name]))).length;

  if (rows.length === 0) findings.push("the motion table is empty");
  for (const row of rows) {
    const missing = COLUMNS.filter((name) => !filled(row[name]));
    if (!filled(row.id)) findings.push(`a motion row has no id (trigger "${row.trigger ?? ""}")`);
    if (missing.length > 0) findings.push(`motion "${row.id ?? "?"}" lacks ${missing.join(", ")}`);
    if (!filled(row.element)) findings.push(`motion "${row.id ?? "?"}" names no element of the inventory`);
  }

  // The required events: a row of that kind, or a reason in noMotion
  const required = REQUIRED_EVENTS[medium] ?? [];
  const still = contract.noMotion && typeof contract.noMotion === "object" ? contract.noMotion : {};
  const kinds = new Set(rows.map((row) => row.kind));
  const missingEvents = required.filter((kind) => !kinds.has(kind) && !filled(still[kind]));
  if (missingEvents.length > 0) findings.push(`required events without a row or a noMotion reason: ${missingEvents.join(", ")}`);

  // States and sizes the prototype opens by URL
  const states = Array.isArray(contract.states) ? contract.states : [];
  const viewports = Array.isArray(contract.viewports) ? contract.viewports : [];
  if (states.length === 0) findings.push("no states: every screen, popup and state of the spec opens by ?state=");
  for (const state of states) if (!filled(state.id)) findings.push("a state has no id");
  if (viewports.length < (MIN_VIEWPORTS[medium] ?? 1)) {
    findings.push(`${viewports.length} target sizes, a ${medium} concept declares at least ${MIN_VIEWPORTS[medium]}`);
  }
  for (const viewport of viewports) {
    if (!parseSize(viewport.size)) findings.push(`target size "${viewport.size}" is not WxH`);
  }
  const rules = Array.isArray(contract.adaptation) ? contract.adaptation.filter(filled) : filled(contract.adaptation) ? [contract.adaptation] : [];
  if (rules.length === 0) findings.push("no adaptation rules: say what stretches, what stays fixed and where the layout breaks between the sizes");

  return {
    medium,
    rows: rows.length,
    columns,
    fullRows,
    events: { required: required.length, covered: required.length - missingEvents.length, missing: missingEvents },
    states: states.length,
    viewports: viewports.length,
    findings
  };
}

/**
 * How many of the eight columns are filled in at least one row: the measure of the baseline (median 3 of 8).
 *
 * @param {ReturnType<typeof checkContract>} result - The static check.
 * @returns {number}
 */
export function columnsPresent(result) {
  return COLUMNS.filter((name) => result.columns[name] > 0).length;
}
