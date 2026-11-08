/**
 * The report of the design check, `check/design-check.md`: the verdict line the rails read, the counts, then
 * only what needs someone — questions for the person, failing rows, open rows, rows nobody measured, and the
 * pairs of shots whose pixels differ most. The full table of rows is `check/result.json`.
 */

import { PAGE } from "./inventory.mjs";

const MAX_LINES = 60;

/**
 * @param {{ slug: string, spec: any, summary: any, rows: any[], deviations: any[], look: any[], date?: string }} input
 * @returns {string}
 */
export function renderReport({ slug, spec, summary, rows, deviations, look, date }) {
  const conversion = spec.conversion.unit === "game" ? `game units = prototype px × ${spec.conversion.reference} / frame width` : "× 1";
  const sizes = spec.sizes.map((size) => `${size.id}${size.target ? "" : " (in between)"}`).join(", ");
  const lines = [
    `# Design check — ${slug} — ${date ?? new Date().toISOString().slice(0, 10)}`,
    `Verdict: ${summary.verdict}    Rows: ${summary.rows}    Pass: ${summary.pass}    By decision: ${summary.decision}    Open: ${summary.open}    Fail: ${summary.fail}    Unmeasured: ${summary.unmeasured}${summary.covered ? `    In a picture: ${summary.covered}` : ""}`,
    `Prototype: ${spec.prototype}    Sizes: ${sizes}    States: ${spec.states.map((state) => state.id).join(", ")}    Conversion: ${conversion}`,
    `Waiting on the person: ${summary.pendingDeviations} deviation(s)${summary.missingSizes.length ? `    Not measured: ${summary.missingSizes.join(", ")}` : ""}`,
    "",
    "Measured by `moku-fidelity` against the fixed inventory of `check/expected.json`; every row is in `check/result.json`.",
  ];

  const pending = deviations.filter((entry) => !entry.decision?.answer);
  if (pending.length > 0) {
    lines.push("", "## Questions for the person", "", "| Id | Element · property | Why | Proposal | Raised |", "|---|---|---|---|---|");
    for (const entry of pending) lines.push(`| ${entry.id} | ${entry.element}${entry.prop ? ` · ${entry.prop}` : ""} | ${cell(entry.reason)} (${entry.kind}) | ${cell(entry.proposal)} | ${entry.asked} by ${entry.by} |`);
  }

  section(lines, "Fonts", rows.filter((row) => row.prop === "font" && row.result === "fail"));
  byElement(lines, "Fail", rows.filter((row) => row.result === "fail" && row.prop !== "font"));
  byDeviation(lines, rows.filter((row) => row.result === "open"));
  collapsed(lines, "Unmeasured", rows.filter((row) => row.result === "unmeasured"));
  section(lines, "By decision", rows.filter((row) => row.result === "decision"));

  if (look.length > 0) {
    lines.push("", "## Look at these pairs (pixel diff, a diagnostic)", "", "Elements whose pixels differ most while their rows pass. Open both shots; a difference the eye sees is a finding: name the property.", "", "| Element | Size · state | Differs | Expected | Actual |", "|---|---|---|---|---|");
    for (const item of look) lines.push(`| ${item.el} | ${item.size} · ${item.state} | ${item.diff} % | check/expected/${item.size}/${item.state}.png | check/actual/${item.size}/${item.state}.png |`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * @param {string[]} lines
 * @param {string} title
 * @param {any[]} rows
 */
function section(lines, title, rows) {
  if (rows.length === 0) return;

  lines.push("", `## ${title} (${rows.length})`, "", "| Row | Element | Property | Size · state | Expected | Actual | Note |", "|---|---|---|---|---|---|---|");
  for (const row of rows.slice(0, MAX_LINES)) lines.push(`| ${row.row} | ${row.el === PAGE ? "page" : row.el} | ${row.prop} | ${row.size} · ${row.state} | ${cell(row.expected)} | ${cell(row.actual)} | ${cell(row.note ?? "")} |`);
  if (rows.length > MAX_LINES) lines.push(`| … | ${rows.length - MAX_LINES} more in check/result.json | | | | | |`);
}

/**
 * Failing rows, one line per element: each property once, with its first expected → actual and where else it
 * fails. What to fix reads at a glance; every row stays in check/result.json.
 *
 * @param {string[]} lines
 * @param {string} title
 * @param {any[]} rows
 */
function byElement(lines, title, rows) {
  if (rows.length === 0) return;

  const elements = new Map();
  for (const row of rows) {
    const props = elements.get(row.el) ?? new Map();
    const seen = props.get(row.prop);
    props.set(row.prop, seen ? { ...seen, where: [...seen.where, `${row.size} · ${row.state}`] } : { row, where: [`${row.size} · ${row.state}`] });
    elements.set(row.el, props);
  }

  lines.push("", `## ${title} (${rows.length} rows, ${elements.size} elements)`, "", "| Element | What differs (prototype → build) | Where |", "|---|---|---|");
  for (const [el, props] of [...elements].slice(0, MAX_LINES)) {
    const what = [...props].map(([prop, { row }]) => `${prop}: ${cell(row.expected)} → ${cell(row.actual)}`).join("; ");
    const where = [...new Set([...props.values()].flatMap((entry) => entry.where))];
    lines.push(`| ${el === PAGE ? "page" : el} | ${what} | ${where.length > 3 ? `${where.slice(0, 3).join(", ")} +${where.length - 3}` : where.join(", ")} |`);
  }
  if (elements.size > MAX_LINES) lines.push(`| … | ${elements.size - MAX_LINES} more elements in check/result.json | |`);
}

/**
 * Open rows, one line per deviation that holds them.
 *
 * @param {string[]} lines
 * @param {any[]} rows
 */
function byDeviation(lines, rows) {
  if (rows.length === 0) return;

  const groups = new Map();
  for (const row of rows) {
    const key = row.deviation ?? "—";
    const group = groups.get(key) ?? { count: 0, elements: new Set() };
    group.count++;
    group.elements.add(row.el);
    groups.set(key, group);
  }

  lines.push("", `## Open (${rows.length}), waiting on the person`, "", "| Deviation | Rows | Elements |", "|---|---|---|");
  for (const [key, group] of groups) lines.push(`| ${key} | ${group.count} | ${[...group.elements].join(", ")} |`);
}

/**
 * Unmeasured rows grouped by element and size, since a missing element leaves all its rows unmeasured.
 *
 * @param {string[]} lines
 * @param {string} title
 * @param {any[]} rows
 */
function collapsed(lines, title, rows) {
  if (rows.length === 0) return;

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.el} · ${row.size} · ${row.state}`;
    groups.set(key, { count: (groups.get(key)?.count ?? 0) + 1, note: row.note ?? "" });
  }

  lines.push("", `## ${title} (${rows.length})`, "", "| Element · size · state | Rows | Why |", "|---|---|---|");
  for (const [key, group] of [...groups].slice(0, MAX_LINES)) lines.push(`| ${key} | ${group.count} | ${cell(group.note)} |`);
}

/** @param {unknown} value */
function cell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
