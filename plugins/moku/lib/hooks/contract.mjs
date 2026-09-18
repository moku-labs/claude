/**
 * Extract the JSON output contract that moku agents put at the end of their report.
 */

/** @typedef {{ agent?: string, verdict?: string, blockers?: unknown[], warnings?: unknown[], stats?: { blockers?: number, warnings?: number } }} Contract */

const FENCED_JSON = /```json\s*([\s\S]*?)```/g;

/**
 * The last fenced `json` block of a message, parsed. Undefined when there is none or it is not valid JSON.
 *
 * @param {string} message
 * @returns {Contract | undefined}
 * @example
 * extractContract('Report...\n```json\n{"agent":"moku-builder","verdict":"PASS"}\n```').verdict; // "PASS"
 */
export function extractContract(message) {
  const blocks = [...message.matchAll(FENCED_JSON)];
  const last = blocks.at(-1)?.[1];
  if (!last) return undefined;

  try {
    return JSON.parse(last);
  } catch {
    return undefined;
  }
}

/**
 * One log-table cell describing the outcome: `PASS B:0 W:2`.
 *
 * @param {Contract | undefined} contract
 * @returns {string}
 * @example
 * summarize({ verdict: "FAIL", blockers: [{}], warnings: [] }); // "FAIL B:1 W:0"
 */
export function summarize(contract) {
  if (!contract?.verdict) return "completed (no contract)";

  const blockers = contract.stats?.blockers ?? contract.blockers?.length ?? 0;
  const warnings = contract.stats?.warnings ?? contract.warnings?.length ?? 0;

  return `${contract.verdict} B:${blockers} W:${warnings}`;
}
