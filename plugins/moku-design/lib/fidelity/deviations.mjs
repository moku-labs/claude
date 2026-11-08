/**
 * Deviations: the places where the build cannot or should not follow the prototype, written down as a question
 * before anything is chosen. The builder writes one the moment it meets the row, before it writes the
 * replacement; the orchestrator puts it to the person; the person's answer is the `decision`.
 *
 * `.planning/design/{slug}/deviations.json`:
 * ```json
 * { "schema": "moku-fidelity/deviations@1", "deviations": [{
 *   "id": "D1", "element": "price-amount", "prop": "font", "sizes": null, "states": null,
 *   "kind": "impossible | conflict | stale-context | unmeasurable | by-design-context",
 *   "reason": "weight 800 is not among the vendored faces",
 *   "proposal": "700, the heaviest vendored face",
 *   "asked": "2026-11-06T10:12:00Z", "by": "moku-builder",
 *   "decision": null | { "answer": "accept" | "reject" | "other", "words": "…", "by": "person | design-context §9", "at": "…" } }] }
 * ```
 * `asked` is when the question was raised, which is before the replacement exists. A pending deviation keeps
 * its rows open and the verdict FAIL; an accepted one turns them into rows by decision.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const DEVIATIONS_SCHEMA = "moku-fidelity/deviations@1";

/** The kinds a deviation can have. */
export const KINDS = ["impossible", "conflict", "stale-context", "unmeasurable", "by-design-context"];

/**
 * @param {string} file
 * @returns {any[]}
 */
export function readDeviations(file) {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(data) ? data : (data.deviations ?? []);
}

/**
 * Append one deviation, raised now. Returns it with its id.
 *
 * @param {string} file
 * @param {{ element: string | string[], prop?: string | string[], kind: string, reason: string, proposal: string, by?: string, sizes?: string[], states?: string[], decision?: any }} entry
 * @returns {any}
 */
export function addDeviation(file, entry) {
  if (!entry.element || (Array.isArray(entry.element) && entry.element.length === 0)) throw new Error("a deviation names its element(s) (--element)");
  if (!KINDS.includes(entry.kind)) throw new Error(`a deviation's kind is one of ${KINDS.join(", ")}`);
  if (!entry.reason || !entry.proposal) throw new Error("a deviation has a reason and a proposal (--reason, --proposal)");

  const list = readDeviations(file);
  const id = `D${list.reduce((max, item) => Math.max(max, Number(String(item.id).slice(1)) || 0), 0) + 1}`;
  const made = { id, element: entry.element, prop: entry.prop ?? null, sizes: entry.sizes ?? null, states: entry.states ?? null, kind: entry.kind, reason: entry.reason, proposal: entry.proposal, asked: new Date().toISOString(), by: entry.by ?? "unknown", decision: entry.decision ?? null };
  writeDeviations(file, [...list, made]);
  return made;
}

/**
 * Record the person's answer to one deviation.
 *
 * @param {string} file
 * @param {string} id
 * @param {{ answer: "accept" | "reject" | "other", words?: string, by?: string }} decision
 * @returns {any}
 */
export function decide(file, id, decision) {
  if (!["accept", "reject", "other"].includes(decision.answer)) throw new Error("the answer is accept, reject or other");
  const list = readDeviations(file);
  const entry = list.find((item) => item.id === id);
  if (!entry) throw new Error(`no deviation ${id} in ${file}`);

  entry.decision = { answer: decision.answer, words: decision.words ?? "", by: decision.by ?? "person", at: new Date().toISOString() };
  writeDeviations(file, list);
  return entry;
}

/**
 * @param {string} file
 * @param {any[]} list
 */
function writeDeviations(file, list) {
  writeFileSync(`${file}.tmp`, `${JSON.stringify({ schema: DEVIATIONS_SCHEMA, deviations: list }, null, 1)}\n`);
  renameSync(`${file}.tmp`, file);
}
