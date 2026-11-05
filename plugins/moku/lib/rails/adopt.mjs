/**
 * Adopting a project: a moku project that exists in the repository but has no `.planning/` here. The folder
 * is local and never committed, so a fresh clone, or a second person, starts without it.
 *
 * One concern: read what the repository shows, and write the local `.planning/` from it. Nothing outside
 * `.planning/` is ever written: configs, package.json, tooling and CLAUDE.md stay as they are.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { activate, isInitialized } from "./ledger.mjs";

/** @typedef {"framework" | "consumer" | "tools" | "game"} ProjectType */

/**
 * @typedef {object} Seen
 * @property {ProjectType} type
 * @property {string} name package.json `name`, or the folder name
 * @property {string} coreVersion the `@moku-labs/core` version, or "" when there is none
 * @property {string} created the date of the first commit, or today outside git
 * @property {Record<string, string>} packages every `@moku-labs/*` dependency with its version
 * @property {string[]} plugins the plugin folders the source holds
 */

/** The types a marker may carry. */
export const PROJECT_TYPES = new Set(["framework", "consumer", "tools", "game"]);

/** Where a project keeps its plugins: a framework or app under `src/`, a game at its root. */
const PLUGIN_DIRS = [join("src", "plugins"), "plugins"];

/**
 * Read what the repository shows about the moku project in it: its type, name, moku packages and plugins.
 *
 * @param {string} root project root
 * @returns {Seen | undefined} undefined when nothing in the directory is moku code
 * @example
 * detectProject("/work/merge-game")?.type; // "game"
 */
export function detectProject(root) {
  const pkg = readPackage(root);
  if (!pkg) return undefined;

  const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
  const packages = Object.fromEntries(Object.entries(dependencies).filter(([name]) => name.startsWith("@moku-labs/")));
  const type = typeOf(root, pkg, packages);
  if (!type) return undefined;

  return {
    type,
    name: typeof pkg.name === "string" && pkg.name ? pkg.name : root.split("/").at(-1) ?? "project",
    coreVersion: (packages["@moku-labs/core"] ?? "").replace(/^[\^~>=<\s]+/, ""),
    created: firstCommitDate(root) ?? today(),
    packages,
    plugins: PLUGIN_DIRS.flatMap((dir) => folders(join(root, dir))),
  };
}

/**
 * The project type, by the same signs the session hook reads, strongest first. A framework holds
 * `createCoreConfig`; a game ships `@moku-labs/game` as a runtime dependency (the editor only develops
 * against it); a consumer calls `createApp`; a library has moku tooling and no moku runtime.
 *
 * @param {string} root
 * @param {Record<string, any>} pkg
 * @param {Record<string, string>} packages
 * @returns {ProjectType | undefined}
 */
function typeOf(root, pkg, packages) {
  if (contains(root, join("src", "config.ts"), "createCoreConfig")) return "framework";
  if (pkg.dependencies?.["@moku-labs/game"]) return "game";
  if (contains(root, join("src", "index.ts"), "createApp") || contains(root, "index.ts", "createApp")) return "consumer";

  const runtime = Object.keys(packages).filter((name) => !["@moku-labs/ci", "@moku-labs/common"].includes(name));
  if (runtime.length > 0) return "consumer";
  if (Object.keys(packages).length > 0) return "tools";

  return undefined;
}

/**
 * Put an existing moku project on the rails in this checkout. Each part of `.planning/` that is missing is
 * written; each part that exists is kept. Running it again changes nothing.
 *
 * @param {string} root project root
 * @param {Seen} seen what `detectProject` read, with the type a person may have set
 * @returns {{ created: string[], kept: string[] }} the `.planning/` files written and the ones left alone
 * @example
 * adoptProject("/work/site", detectProject("/work/site")); // { created: ["state.json", "moku.md"], kept: [] }
 */
export function adoptProject(root, seen) {
  const created = [];
  const kept = [];

  (activate(root) ? created : kept).push("state.json");

  if (isInitialized(root)) {
    kept.push("moku.md");
  } else {
    writeFileSync(join(root, ".planning", "moku.md"), marker(seen));
    created.push("moku.md");
  }

  return { created, kept };
}

/**
 * The marker, in the format the init station writes and the hooks read, with what adopt saw below it.
 *
 * @param {Seen} seen
 * @returns {string}
 */
function marker(seen) {
  const packages = Object.entries(seen.packages).map(([name, version]) => `- ${name} ${version}`);
  const plugins = seen.plugins.map((name) => `- ${name}`);

  return [
    "# Moku Project",
    "",
    `type: ${seen.type}`,
    `name: ${seen.name}`,
    `core_version: ${seen.coreVersion}`,
    `created: ${seen.created}`,
    `adopted: ${today()}`,
    "",
    "Written by `moku-rails adopt` from what the repository shows. `.planning/` is local: every clone adopts its own.",
    "",
    "## Moku packages",
    "",
    ...(packages.length > 0 ? packages : ["- none"]),
    "",
    "## Plugins",
    "",
    ...(plugins.length > 0 ? plugins : ["- none"]),
    "",
  ].join("\n");
}

/**
 * Whether git keeps `.planning/` out of commits here. Outside a git repository there is nothing to leak.
 *
 * @param {string} root
 * @returns {boolean}
 */
export function planningIgnored(root) {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { cwd: root, stdio: "ignore" });
  } catch {
    return true;
  }

  try {
    execFileSync("git", ["check-ignore", "-q", ".planning/state.json"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @returns {Record<string, any> | undefined}
 */
function readPackage(root) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * @param {string} root
 * @param {string} file
 * @param {string} text
 * @returns {boolean}
 */
function contains(root, file, text) {
  const path = join(root, file);
  return existsSync(path) && readFileSync(path, "utf8").includes(text);
}

/**
 * @param {string} dir
 * @returns {string[]} the folders in it, sorted
 */
function folders(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * @param {string} root
 * @returns {string | undefined} YYYY-MM-DD of the repository's first commit
 */
function firstCommitDate(root) {
  try {
    const dates = execFileSync("git", ["log", "--reverse", "--format=%cs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return dates.split("\n")[0] || undefined;
  } catch {
    return undefined;
  }
}

/** @returns {string} today as YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10);
}
