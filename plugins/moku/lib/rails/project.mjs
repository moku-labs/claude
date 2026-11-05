/**
 * Read an existing moku project from what its repository already holds, for `moku-rails init adopt`.
 *
 * `.planning/` is gitignored, so a fresh clone of a moku project has no marker and looks uninitialized.
 * The scaffold would overwrite its tooling. Adopting reads the type, the name and the core version from
 * `package.json`, the sources and the lockfile instead, and writes only the marker.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** @typedef {"framework" | "consumer" | "tools" | "game"} ProjectType */
/** @typedef {{ type: ProjectType, name: string, coreVersion: string, coreFrom: string, reasons: string[] }} Detected */

export const PROJECT_TYPES = ["framework", "consumer", "tools", "game"];

/** Packages that are tooling, not a framework an app is built on. */
const TOOLING_PACKAGES = new Set(["@moku-labs/ci", "@moku-labs/common", "@moku-labs/editor", "@moku-labs/ai"]);

/** Where the sources of each kind of project live. A game keeps `index.ts` and `config.ts` at the root. */
const SOURCE_DIRS = ["src"];
const ROOT_SOURCES = ["index.ts", "config.ts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx"]);

/** A source scan stops here: the factory calls sit in a handful of files near the top. */
const MAX_SOURCE_FILES = 2000;

/**
 * Detect the moku project in a directory, or undefined when it holds none: no `package.json` that names
 * `@moku-labs/*`, and no `createApp`, `createCoreConfig` or `defineGameApp` in the sources.
 *
 * @param {string} root project root
 * @returns {Detected | undefined}
 * @example
 * detectProject("/work/site"); // { type: "consumer", name: "site", coreVersion: "1.7.6", coreFrom: "bun.lock", reasons: [...] }
 */
export function detectProject(root) {
  const manifest = readJson(join(root, "package.json")) ?? {};
  const runtime = { ...manifest.peerDependencies, ...manifest.dependencies };
  const all = { ...manifest.devDependencies, ...runtime };
  const mokuAny = Object.keys(all).filter((name) => name.startsWith("@moku-labs/"));
  const mokuRuntime = Object.keys(runtime).filter((name) => name.startsWith("@moku-labs/") && !TOOLING_PACKAGES.has(name));
  const calls = scanSources(root);

  if (mokuAny.length === 0 && calls.size === 0) return undefined;

  const { type, reasons } = classify(runtime, mokuRuntime, calls);
  const core = type === "tools" ? { version: "", from: "none (a library has no core)" } : coreVersion(root);

  return { type, name: manifest.name ?? "", coreVersion: core.version, coreFrom: core.from, reasons };
}

/**
 * The marker body the init station writes, in the format `detect-moku-project.sh` and `moku-rails` read.
 *
 * @param {{ type: string, name: string, coreVersion: string }} project
 * @param {string} created `YYYY-MM-DD`
 * @returns {string}
 * @example
 * markerBody({ type: "consumer", name: "site", coreVersion: "1.7.6" }, "2026-11-05");
 */
export function markerBody({ type, name, coreVersion }, created) {
  return `# Moku Project\n\ntype: ${type}\nname: ${name}\ncore_version: ${coreVersion}\ncreated: ${created}\n`;
}

/**
 * Pick the type from the runtime dependencies first, and from the factory calls only when they name none.
 *
 * @param {Record<string, string>} runtime dependencies and peerDependencies
 * @param {string[]} mokuRuntime the `@moku-labs/*` runtime packages that are not tooling
 * @param {Set<string>} calls the factory calls found in the sources
 * @returns {{ type: ProjectType, reasons: string[] }}
 */
function classify(runtime, mokuRuntime, calls) {
  // Dependencies decide: a source file may quote another layer's calls, as a docs site does
  if ("@moku-labs/game" in runtime) return { type: "game", reasons: ["@moku-labs/game in dependencies"] };
  // A framework builds on core directly; an app reaches core only through its framework
  if ("@moku-labs/core" in runtime) return { type: "framework", reasons: ["@moku-labs/core in dependencies"] };
  if (mokuRuntime.length > 0) return { type: "consumer", reasons: [`${mokuRuntime.join(", ")} in dependencies`] };

  if (calls.has("defineGameApp")) return { type: "game", reasons: ["defineGameApp in the sources"] };
  if (calls.has("createCoreConfig")) return { type: "framework", reasons: ["createCoreConfig in the sources"] };
  if (calls.has("createApp")) return { type: "consumer", reasons: ["createApp in the sources"] };

  return { type: "tools", reasons: ["only moku tooling packages, no moku runtime dependency"] };
}

/**
 * The installed `@moku-labs/core` version: from `node_modules` when installed, else from `bun.lock`, so a
 * fresh clone without an install still gets it.
 *
 * @param {string} root project root
 * @returns {{ version: string, from: string }}
 */
function coreVersion(root) {
  const installed = readJson(join(root, "node_modules", "@moku-labs", "core", "package.json"))?.version;
  if (installed) return { version: installed, from: "node_modules/@moku-labs/core" };

  const lock = join(root, "bun.lock");
  const locked = existsSync(lock) ? /"@moku-labs\/core":\s*\["@moku-labs\/core@([^"]+)"/.exec(readFileSync(lock, "utf8"))?.[1] : undefined;
  if (locked) return { version: locked, from: "bun.lock" };

  return { version: "", from: "not found (no node_modules, no bun.lock entry)" };
}

/**
 * Which of the moku factory calls appear in the project's sources.
 *
 * @param {string} root project root
 * @returns {Set<string>} a subset of createApp, createCoreConfig, defineGameApp
 */
function scanSources(root) {
  const found = new Set();
  const files = [...ROOT_SOURCES.map((name) => join(root, name)).filter((file) => existsSync(file)), ...SOURCE_DIRS.flatMap((dir) => listSources(join(root, dir)))];

  for (const file of files.slice(0, MAX_SOURCE_FILES)) {
    const text = readFileSync(file, "utf8");
    for (const call of ["createApp", "createCoreConfig", "defineGameApp"]) {
      if (new RegExp(`\\b${call}\\s*[(<]`).test(text)) found.add(call);
    }
  }

  return found;
}

/**
 * @param {string} dir
 * @returns {string[]} source files under dir, node_modules skipped
 */
function listSources(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listSources(path);
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

/**
 * @param {string} file
 * @returns {any} the parsed JSON, or undefined when the file is missing or not JSON
 */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}
