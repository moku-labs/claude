/**
 * Artifact verification: the three levels over one plugin directory.
 *
 * This module owns the filesystem reads; the decisions belong to tiers.mjs,
 * substance.mjs and wiring.mjs, which stay pure.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { judgeSource, judgeTest } from "./substance.mjs";
import { expectedFiles, inferTier, normalizeTier, readDeclaredTier } from "./tiers.mjs";
import { COMPOSITION_FILES, judgeWiring, runChecks } from "./wiring.mjs";

/** @typedef {{ level: 1 | 2 | 3, file: string, message: string, fix: string }} Finding */
/** @typedef {{ plugin: string, tier: string, dir: string, verdict: "PASS" | "FAIL", findings: Finding[], checks: Array<{ command: string, ok: boolean, detail: string }>, stats: Record<string, number> }} Report */

/**
 * Verify one plugin: exists, substantive, wired.
 *
 * @param {{ root: string, name: string, tier?: string | null, run?: boolean }} options
 * @returns {Report}
 * @example
 * verifyPlugin({ root: "/tmp/app", name: "streak" }).verdict; // "FAIL" when index.ts is a stub
 */
export function verifyPlugin({ root, name, tier = null, run = false }) {
  const dir = join(root, "src", "plugins", name);
  if (!existsSync(dir)) {
    const missing = { level: 1, file: relative(root, dir), message: "plugin directory does not exist", fix: `create src/plugins/${name}/ from the skeleton` };
    return { plugin: name, tier: tier ?? "unknown", dir: relative(root, dir), verdict: "FAIL", findings: [missing], checks: [], stats: { blockers: 1, filesChecked: 0 } };
  }

  // Settle the tier: the flag wins, then the index header, then the shape on disk
  const files = listFiles(dir);
  const index = readIfPresent(join(dir, "index.ts"));
  const resolved = normalizeTier(tier) ?? readDeclaredTier(index ?? "") ?? inferTier(files);

  // The three levels, each adding to one findings list
  const findings = [...levelExists(dir, name, resolved, files), ...levelSubstantive(dir, files)];
  const composition = COMPOSITION_FILES.map((file) => ({ file, source: readIfPresent(join(root, file)) })).filter((entry) => entry.source !== null);
  findings.push(...levelWired(name, composition));

  // Scoped test and lint runs are facts only when they were asked for
  const checks = run ? runChecks(root, join("src", "plugins", name)) : [];
  for (const check of checks.filter((entry) => !entry.ok)) {
    findings.push({ level: 3, file: relative(root, dir), message: `${check.command} failed: ${check.detail}`, fix: "fix the reported failures, then run the check again" });
  }

  const stats = { filesChecked: files.length, blockers: findings.length };
  return { plugin: name, tier: resolved, dir: relative(root, dir), verdict: findings.length === 0 ? "PASS" : "FAIL", findings, checks, stats };
}

/**
 * Level 1: every file the tier requires is present.
 *
 * @param {string} dir absolute plugin directory
 * @param {string} name plugin name
 * @param {string} tier canonical tier
 * @param {string[]} files paths relative to the plugin directory
 * @returns {Finding[]}
 * @example
 * levelExists("/tmp/app/src/plugins/streak", "streak", "nano", ["index.ts"]).length; // 2
 */
export function levelExists(dir, name, tier, files) {
  const present = new Set(files);
  const { required, conditional } = expectedFiles(tier, name);
  const findings = [];

  // What the tier always demands
  for (const file of required) {
    if (!present.has(file)) findings.push({ level: 1, file, message: `missing, required for tier ${tier}`, fix: `add src/plugins/${name}/${file}` });
  }

  // What a present domain file drags in with it
  for (const { when, then } of conditional) {
    if (present.has(when) && !present.has(then)) findings.push({ level: 1, file: then, message: `missing unit test for ${when}`, fix: `add src/plugins/${name}/${then}` });
  }

  // A small tier still needs its one unit test, whatever it is called
  const hasUnitTest = files.some((file) => file.startsWith("__tests__/unit/") && file.endsWith(".test.ts"));
  if (!hasUnitTest && !findings.some((finding) => finding.file.startsWith("__tests__/unit/"))) {
    findings.push({ level: 1, file: "__tests__/unit/", message: "no unit test files", fix: `add unit tests under src/plugins/${name}/__tests__/unit/` });
  }

  return findings;
}

/**
 * Level 2: the files that exist carry real content.
 *
 * @param {string} dir absolute plugin directory
 * @param {string[]} files paths relative to the plugin directory
 * @returns {Finding[]}
 * @example
 * levelSubstantive("/tmp/app/src/plugins/streak", ["index.ts"]);
 */
export function levelSubstantive(dir, files) {
  const findings = [];

  for (const file of files.filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
    const source = readIfPresent(join(dir, file)) ?? "";
    const isTest = file.includes("__tests__");
    const verdict = isTest ? judgeTest(source) : judgeSource(source);

    if (verdict.stub) {
      const fix = isTest ? "assert the behavior the spec describes" : "implement the file, or delete it if the tier does not need it";
      findings.push({ level: 2, file, message: `stub: ${verdict.reasons.join("; ")}`, fix });
    }
  }

  return findings;
}

/**
 * Level 3: the plugin is registered where the project composes plugins.
 *
 * @param {string} name plugin name
 * @param {Array<{ file: string, source: string }>} composition composition files that exist
 * @returns {Finding[]}
 * @example
 * levelWired("streak", [{ file: "src/index.ts", source: "plugins: [streakPlugin]" }]); // []
 */
export function levelWired(name, composition) {
  const wiring = judgeWiring(name, composition);
  if (wiring.wired) return [];

  const fix = "export the plugin from src/plugins/index.ts and add it to the plugins array of createCore or createApp";
  return wiring.reasons.map((reason) => ({ level: 3, file: composition[0]?.file ?? "src/index.ts", message: reason, fix }));
}

/**
 * Every file under a directory, as paths relative to it.
 *
 * @param {string} dir absolute directory
 * @returns {string[]}
 * @example
 * listFiles("/tmp/app/src/plugins/streak"); // ["index.ts", "__tests__/unit/index.test.ts"]
 */
export function listFiles(dir) {
  const walk = (current) =>
    readdirSync(current).flatMap((entry) => {
      const full = join(current, entry);
      return statSync(full).isDirectory() ? walk(full) : [relative(dir, full)];
    });

  return existsSync(dir) ? walk(dir).sort() : [];
}

/**
 * Read a file, or null when it is not there.
 *
 * @param {string} file absolute path
 * @returns {string | null}
 */
function readIfPresent(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}
