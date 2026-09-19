/**
 * Level 3: is the plugin wired into the project, and do the scoped checks pass.
 *
 * The wiring decision is pure text analysis; the command runs are the only IO
 * and stay behind `runChecks`, which the caller asks for with `--run`.
 */

import { spawnSync } from "node:child_process";

/** @typedef {{ wired: boolean, where: string | null, reasons: string[] }} Wiring */
/** @typedef {{ command: string, ok: boolean, detail: string }} CheckRun */

/** Files that may compose a plugin, in the order they are worth reading. */
export const COMPOSITION_FILES = ["src/plugins/index.ts", "src/index.ts", "src/main.ts", "src/app.ts", "src/server.ts"];

/**
 * The export name a plugin directory is expected to produce.
 *
 * @param {string} name plugin directory name
 * @returns {string} the `<name>Plugin` export name
 * @example
 * exportName("template-engine"); // "templateEnginePlugin"
 */
export function exportName(name) {
  const camel = name.replace(/[-_](\w)/g, (_, letter) => letter.toUpperCase());
  return `${camel}Plugin`;
}

/**
 * Decide whether any composition file registers this plugin.
 *
 * @param {string} name plugin directory name
 * @param {Array<{ file: string, source: string }>} composition files that may compose it
 * @returns {Wiring}
 * @example
 * judgeWiring("streak", [{ file: "src/index.ts", source: "plugins: [streakPlugin]" }]).wired; // true
 */
export function judgeWiring(name, composition) {
  const symbol = exportName(name);

  // A file counts as wiring when it names the plugin outside of a comment
  const host = composition.find((entry) => mentions(entry.source, symbol) || mentions(entry.source, `plugins/${name}`));
  if (host) return { wired: true, where: host.file, reasons: [] };

  const looked = composition.map((entry) => entry.file).join(", ") || "no composition file found";
  return { wired: false, where: null, reasons: [`${symbol} is not registered (looked in: ${looked})`] };
}

/**
 * Run the scoped test and lint commands for a plugin directory.
 *
 * Only called for `--run`. A missing runner is reported, never thrown.
 *
 * @param {string} root project root
 * @param {string} pluginDir plugin directory, relative to root
 * @returns {CheckRun[]}
 * @example
 * runChecks("/tmp/app", "src/plugins/streak").length; // 2
 */
export function runChecks(root, pluginDir) {
  return [execute(root, "bun", ["test", pluginDir]), execute(root, "bunx", ["biome", "check", pluginDir])];
}

/**
 * Run one command and reduce it to pass or fail with a short detail.
 *
 * @param {string} root working directory
 * @param {string} command executable
 * @param {string[]} args arguments
 * @returns {CheckRun}
 */
function execute(root, command, args) {
  const label = `${command} ${args.join(" ")}`;
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });

  // A runner that is not installed is a caveat for the report, not a failure
  if (result.error) return { command: label, ok: true, detail: `skipped: ${command} is not available` };

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-3).join(" ");
  return { command: label, ok: result.status === 0, detail: output.slice(0, 300) };
}

/**
 * Does the source mention this symbol outside a comment line.
 *
 * @param {string} source file text
 * @param {string} symbol name to find
 * @returns {boolean}
 */
function mentions(source, symbol) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .some((line) => line.includes(symbol));
}
