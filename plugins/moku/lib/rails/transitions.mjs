/**
 * Transition rules: may a change enter a station, may it close.
 *
 * Pure decisions over plain data. Every refusal names the missing step,
 * so the conductor can offer it to the user instead of guessing.
 */

import { OPTIONAL_STATIONS, PRE_INIT_STATIONS, requiredBefore, routeFor } from "./routes.mjs";

/** @typedef {{ ok: true } | { ok: false, reason: string, missing: string }} Verdict */

/** Checklist items that must all be true before a change can close. */
export const CLOSE_CHECKLIST = ["tests", "verify", "docs"];

/**
 * Decide whether a change may enter a station.
 *
 * @param {{ initialized: boolean }} project
 * @param {{ size: "S" | "M" | "L", done: string[], skipped?: string[] }} change
 * @param {string} station
 * @returns {Verdict}
 * @example
 * canEnter({ initialized: false }, { size: "M", done: ["intake"] }, "build");
 * // { ok: false, missing: "init", reason: "..." }
 */
export function canEnter(project, change, station) {
  const route = routeFor(change.size);

  // The station must exist on this change's route
  if (!route.includes(station)) {
    return refuse(station, `Station "${station}" is not on the route of a size ${change.size} change (${route.join(" → ")}).`);
  }

  // Nothing beyond talking and sketching happens in an uninitialized project
  if (!project.initialized && !PRE_INIT_STATIONS.has(station)) {
    return refuse("init", `The project is not initialized. Code written now would not match the moku architecture. Run the init station first.`);
  }

  // Every required earlier station must be done
  const missing = requiredBefore(change.size, station).find((name) => !change.done.includes(name));
  if (missing) {
    return refuse(missing, `Station "${missing}" must be done before "${station}".`);
  }

  // An optional station is passed by doing it or by skipping it on purpose, never by forgetting it.
  // Optional stations may swap places among themselves, so only a required station asks for the decision.
  const undecided = OPTIONAL_STATIONS.has(station) ? undefined : route.slice(0, route.indexOf(station)).find((name) => OPTIONAL_STATIONS.has(name) && !change.done.includes(name) && !(change.skipped ?? []).includes(name));
  if (undecided) {
    return refuse(undecided, `Station "${undecided}" is neither done nor skipped. Do it, or ask the person and record their answer with \`moku-rails skip ${undecided} --reason "<their words>"\`.`);
  }

  return { ok: true };
}

/**
 * Decide whether a change may close.
 *
 * @param {{ size: "S" | "M" | "L", done: string[], skipped?: string[], checklist: Record<string, boolean> }} change
 * @returns {Verdict}
 * @example
 * canClose({ size: "S", done: ["intake", "build", "verify"], checklist: { tests: true, verify: true, docs: false } });
 * // { ok: false, missing: "docs", reason: "..." }
 */
export function canClose(change) {
  const entry = canEnter({ initialized: true }, change, "close");
  if (!entry.ok) return entry;

  const open = CLOSE_CHECKLIST.find((item) => change.checklist[item] !== true);
  if (open) {
    return refuse(open, `Checklist item "${open}" is not confirmed. A change closes only with tests green, verify passed and docs updated.`);
  }

  return { ok: true };
}

/**
 * @param {string} missing
 * @param {string} reason
 * @returns {Verdict}
 */
function refuse(missing, reason) {
  return { ok: false, missing, reason };
}
