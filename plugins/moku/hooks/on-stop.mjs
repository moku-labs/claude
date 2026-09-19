#!/usr/bin/env node
/**
 * Stop hook: the session may not end while a change sits inside a writing station.
 *
 * A station that waits for the user is paused first (`moku-rails pause`), which makes stopping legitimate.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { loadLedger } from "../lib/rails/ledger.mjs";
import { WRITING_STATIONS } from "../lib/rails/routes.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);

// Off the rails: stopping is nobody's business
if (!root) process.exit(0);

// Already continuing because of this hook: never block twice, that would loop
if (payload.stop_hook_active === true) process.exit(0);

// A change abandoned inside build, verify or e2e
const active = loadLedger(root).changes.find((change) => change.status === "open" && !change.paused && WRITING_STATIONS.has(change.station ?? ""));
if (active) block(`Change ${active.id} is inside station "${active.station}". Finish the station, or run \`moku-rails pause --reason "<why>"\` if you are waiting for the user.`);

// A build wave still marked active in the human-readable state
const state = join(root, ".planning", "STATE.md");
const waveActive = existsSync(state) && /\|\s*(active|building|in-progress)\s*\|/.test(readFileSync(state, "utf8"));
if (waveActive && !pausedForUser(root)) block("A build wave is still active in .planning/STATE.md. Complete it, or pause the change if you are waiting for the user.");

/**
 * True when stopping is a deliberate hand-over: every open change is paused, or nothing is open at all.
 * A stale "building" row left by a crashed wave must not trap a user who has no open change.
 */
function pausedForUser(projectRoot) {
  const open = loadLedger(projectRoot).changes.filter((change) => change.status === "open");
  return open.every((change) => change.paused);
}

/** @param {string} reason */
function block(reason) {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
