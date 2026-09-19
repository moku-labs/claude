/**
 * Rendering for `moku-verify-artifacts`: a report object becomes lines or JSON.
 *
 * Pure. The bin entry prints what this returns and exits on the code.
 */

/** @typedef {import("./verify.mjs").Report} Report */

const LEVEL_NAMES = { 1: "exists", 2: "substantive", 3: "wired" };

/**
 * Render a report for a person reading a terminal.
 *
 * @param {Report} report one plugin's verification result
 * @returns {string[]} lines to print
 * @example
 * formatReport({ plugin: "streak", tier: "nano", verdict: "PASS", findings: [], checks: [], stats: {} });
 * // ["streak (nano): PASS", ...]
 */
export function formatReport(report) {
  const lines = [`${report.plugin} (${report.tier}): ${report.verdict}`];

  // One line per finding, grouped by the level that produced it
  for (const level of [1, 2, 3]) {
    const found = report.findings.filter((finding) => finding.level === level);
    for (const finding of found) lines.push(`  L${level} ${LEVEL_NAMES[level]}: ${finding.file} — ${finding.message}. Fix: ${finding.fix}`);
  }

  // Scoped runs only appear when --run asked for them
  for (const check of report.checks) lines.push(`  run: ${check.command} — ${check.ok ? "ok" : "failed"}${check.detail ? ` (${check.detail})` : ""}`);

  if (report.findings.length === 0) lines.push("  all three levels pass");
  return lines;
}

/**
 * The exit code a report earns: 0 pass, 2 fail.
 *
 * @param {Report} report one plugin's verification result
 * @returns {0 | 2}
 * @example
 * exitCodeFor({ verdict: "FAIL" }); // 2
 */
export function exitCodeFor(report) {
  return report.verdict === "PASS" ? 0 : 2;
}

/**
 * Render a report as the JSON payload `--json` prints.
 *
 * @param {Report} report one plugin's verification result
 * @returns {string} a single JSON line
 * @example
 * JSON.parse(formatJson(report)).verdict; // "PASS"
 */
export function formatJson(report) {
  return JSON.stringify(report);
}
