/**
 * Station tables for the moku railway.
 *
 * A route is the ordered list of stations a change travels through.
 * Pure data and pure lookups: no filesystem, no process state.
 */

/** @typedef {"S" | "M" | "L"} ChangeSize */
/** @typedef {"intake" | "brainstorm" | "design" | "plan" | "build" | "verify" | "e2e" | "release" | "close"} Station */

/** Every station a change can visit, in travel order. */
export const STATIONS = ["intake", "brainstorm", "design", "plan", "build", "verify", "e2e", "release", "close"];

/** Stations a change may skip without breaking the architecture. */
export const OPTIONAL_STATIONS = new Set(["brainstorm", "design", "e2e", "release"]);

/** Stations that are safe before the project is initialized: talking and sketching only. */
export const PRE_INIT_STATIONS = new Set(["intake", "brainstorm", "design"]);

/** Stations during which source files may be written. */
export const WRITING_STATIONS = new Set(["build", "verify", "e2e"]);

/** @type {Record<ChangeSize, Station[]>} */
const ROUTES = {
  S: ["intake", "build", "verify", "close"],
  M: ["intake", "plan", "build", "verify", "e2e", "release", "close"],
  L: ["intake", "brainstorm", "design", "plan", "build", "verify", "e2e", "release", "close"],
};

/**
 * The ordered stations for a change of the given size.
 *
 * @param {ChangeSize} size
 * @returns {Station[]}
 * @example
 * routeFor("S"); // ["intake", "build", "verify", "close"]
 */
export function routeFor(size) {
  const route = ROUTES[size];
  if (!route) throw new Error(`Unknown change size "${size}". Use S, M or L.`);

  return route;
}

/**
 * The stations that must be done before `station` on this route.
 * Optional stations are never required.
 *
 * @param {ChangeSize} size
 * @param {Station} station
 * @returns {Station[]}
 * @example
 * requiredBefore("M", "build"); // ["intake", "plan"]
 */
export function requiredBefore(size, station) {
  const route = routeFor(size);
  const position = route.indexOf(station);
  if (position === -1) return [];

  return route.slice(0, position).filter((name) => !OPTIONAL_STATIONS.has(name));
}
