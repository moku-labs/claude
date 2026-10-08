/**
 * Station tables for the moku railway.
 *
 * A route is the ordered list of stations a change travels through.
 * Pure data and pure lookups: no filesystem, no process state.
 */

/** @typedef {"Q" | "S" | "M" | "L"} ChangeSize */
/** @typedef {"intake" | "brainstorm" | "design" | "plan" | "tweak" | "build" | "verify" | "e2e" | "release" | "close"} Station */

/** Every station a change can visit, in travel order. */
export const STATIONS = ["intake", "brainstorm", "design", "plan", "tweak", "build", "verify", "e2e", "release", "close"];

/** Stations a change may skip without breaking the architecture. */
export const OPTIONAL_STATIONS = new Set(["brainstorm", "design", "e2e", "release"]);

/** Stations that are safe before the project is initialized: talking and sketching only. */
export const PRE_INIT_STATIONS = new Set(["intake", "brainstorm", "design"]);

/** Stations during which source files may be written. */
export const WRITING_STATIONS = new Set(["tweak", "build", "verify", "e2e"]);

/**
 * Stations the person drives turn by turn: they send an edit, it is made, they look, they send the next.
 * Every request inside such a station is work of that station, so none needs routing, and the turn may end
 * after each one. The checks come once, at the verify station, when the person says the edits are right.
 */
export const LOOP_STATIONS = new Set(["tweak"]);

/** @type {Record<ChangeSize, Station[]>} */
const ROUTES = {
  Q: ["intake", "tweak", "verify", "close"],
  S: ["intake", "build", "verify", "close"],
  M: ["intake", "design", "plan", "build", "verify", "e2e", "release", "close"],
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
  if (!route) throw new Error(`Unknown change size "${size}". Use Q, S, M or L.`);

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

/** A quick edit that touches more files than this is not quick any more. */
const TWEAK_MAX_FILES = 2;

/** Paths where a small edit can break more than it shows: public API, wiring, configuration, tooling. */
const TWEAK_SENSITIVE = [
  { pattern: /(?:^|\/)src\/(?:index|config|app|main|server|game)\.tsx?$/, why: "it is the project's root wiring" },
  { pattern: /(?:^|\/)src\/plugins\/[^/]+\/(?:index|types|api|state|events)\.ts$/, why: "it is a plugin's public surface" },
  { pattern: /(?:^|\/)src\/core\//, why: "it is shared core code" },
  { pattern: /(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|[^/]*\.config\.[cm]?[jt]s|\.oxlintrc\.json|biome\.jsonc?)$/, why: "it is tooling or configuration" },
];

/**
 * Who makes a quick edit: the fast agent, or the builder. The answer is counted, not judged: a model that
 * sizes its own task sizes it small.
 *
 * The fast agent takes an edit of at most two existing files, none of them a sensitive one. Anything else
 * goes to the builder: a third file, a new file, a public surface, configuration, or an edit the fast agent
 * already missed twice.
 *
 * @param {string[]} paths project-relative files the edit touches
 * @param {{ exists: (path: string) => boolean, misses?: number }} facts whether a file exists, and how often the fast agent already missed this edit
 * @returns {{ tier: "fast" | "deep", reasons: string[] }} `reasons` is empty for the fast tier
 * @example
 * tweakTier(["src/plugins/hud/view.ts"], { exists: () => true }); // { tier: "fast", reasons: [] }
 * tweakTier(["src/plugins/hud/index.ts"], { exists: () => true }); // { tier: "deep", reasons: ["src/plugins/hud/index.ts: it is a plugin's public surface"] }
 */
export function tweakTier(paths, facts) {
  const reasons = [];

  if (paths.length === 0) reasons.push("no file is named yet: find the files first");
  if (paths.length > TWEAK_MAX_FILES) reasons.push(`${paths.length} files, more than ${TWEAK_MAX_FILES}`);
  if ((facts.misses ?? 0) >= 2) reasons.push(`the fast agent missed this edit ${facts.misses} times`);

  for (const path of paths) {
    if (!facts.exists(path)) reasons.push(`${path}: a new file`);

    const sensitive = TWEAK_SENSITIVE.find((entry) => entry.pattern.test(path));
    if (sensitive) reasons.push(`${path}: ${sensitive.why}`);
  }

  return { tier: reasons.length === 0 ? "fast" : "deep", reasons };
}
