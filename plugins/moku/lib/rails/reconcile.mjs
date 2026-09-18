/**
 * Reconcile: compare the ledger with reality before new work is accepted.
 *
 * Read-only. It reports debts, it never fixes them.
 */

import { execFileSync } from "node:child_process";

/** @typedef {{ kind: "open-change" | "stuck-station" | "dirty-tree" | "parked", detail: string }} Debt */

/**
 * List what is unfinished in the project.
 *
 * @param {string} root project root
 * @param {import("./ledger.mjs").Ledger} ledger
 * @returns {Debt[]}
 * @example
 * reconcile(process.cwd(), ledger); // [] when the project is clean
 */
export function reconcile(root, ledger) {
  /** @type {Debt[]} */
  const debts = [];

  // Open changes are debts until they close or are parked on purpose
  for (const change of ledger.changes.filter((entry) => entry.status === "open")) {
    const where = change.station ? `inside station "${change.station}"` : `after ${change.done.at(-1) ?? "nothing"}`;
    debts.push({ kind: change.station ? "stuck-station" : "open-change", detail: `${change.id} (${change.size}, ${change.type}) is open, ${where}.` });
  }

  // Parked changes are listed so they are never forgotten
  for (const change of ledger.changes.filter((entry) => entry.status === "parked")) {
    debts.push({ kind: "parked", detail: `${change.id} is parked: ${change.note ?? "no reason recorded"}.` });
  }

  // Uncommitted work with no open change means something happened off the rails
  const dirty = uncommittedFiles(root);
  const hasOpenChange = ledger.changes.some((entry) => entry.status === "open");
  if (dirty.length > 0 && !hasOpenChange) {
    debts.push({ kind: "dirty-tree", detail: `${dirty.length} uncommitted file(s) and no open change: ${dirty.slice(0, 5).join(", ")}.` });
  }

  return debts;
}

/**
 * Uncommitted paths according to git, or none outside a repository.
 *
 * @param {string} root
 * @returns {string[]}
 */
function uncommittedFiles(root) {
  try {
    const output = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return output.split("\n").filter(Boolean).map((line) => line.slice(3));
  } catch {
    return [];
  }
}
