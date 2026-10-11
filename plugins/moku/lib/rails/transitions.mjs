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

/** Stations that leave the look of a change built. A change with a design finishes them only on a passed design check. */
export const DESIGN_CHECKED_STATIONS = new Set(["build", "e2e"]);

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
 * Decide whether a change may finish a station. A change that carries a design finishes `build` and `e2e`
 * only when the design check passed: the build was compared to the approved prototype and no row is open.
 *
 * @param {{ design?: string }} change
 * @param {string} station
 * @param {"PASS" | "FAIL" | undefined} check verdict of the design check report; undefined when there is no report
 * @returns {Verdict}
 * @example
 * canFinish({ design: "board" }, "build", "FAIL");
 * // { ok: false, missing: "design-check", reason: "..." }
 */
export function canFinish(change, station, check) {
  if (!change.design || !DESIGN_CHECKED_STATIONS.has(station)) return { ok: true };
  if (check === "PASS") return { ok: true };

  const report = `.planning/design/${change.design}/check/design-check.md`;
  const state = check === "FAIL" ? `The design check has open rows (${report} says FAIL).` : `The design check did not run (no verdict in ${report}).`;

  return refuse("design-check", `${state} The change follows the design "${change.design}", so "${station}" is done only when the build matches the prototype. Run the design check and fix the open rows, or ask the person and record their answer with \`moku-rails done ${station} --no-design-check "<their words>"\`.`);
}

/**
 * @param {string} missing
 * @param {string} reason
 * @returns {Verdict}
 */
function refuse(missing, reason) {
  return { ok: false, missing, reason };
}
