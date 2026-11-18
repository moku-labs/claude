#!/usr/bin/env node
/**
 * Stop hook: the session may not end while a change sits inside a writing station.
 *
 * Four ends of a turn are legitimate inside a station: the station is paused for the user
 * (`moku-rails pause`); agents spawned from it are still running (the station records them, and the
 * harness lists them as background tasks); a background command still runs (tests, a visual re-record, a
 * commit with its hooks), whose end wakes the session; or the turn ends on a question to the person.
 * None of them is walking away, so no pause is required. In the week of 2026-11-08, 50 of 58 blocks were
 * turns waiting on a background command, and each one made the session run `pause` and `continue` for nothing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { forgetFinished, runningAgents } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { loadLedger } from "../lib/rails/ledger.mjs";
import { LOOP_STATIONS, WRITING_STATIONS } from "../lib/rails/routes.mjs";

const { payload } = readHookInput();

const root = rootForSession(payload);

// Off the rails: stopping is nobody's business
if (!root) process.exit(0);

// The turn of the main session ended: a record of an agent the harness no longer lists has no agent behind it
if (!payload.agent_id) forgetFinished(root, payload.session_id, payload.background_tasks);

// Already continuing because of this hook: never block twice, that would loop
if (payload.stop_hook_active === true) process.exit(0);

// Agents or commands still running inside the station: the turn ends to wait for them, which is what it should do
if (waitingForWork(root, payload)) process.exit(0);

// The turn ends on a question: the station waits for the person's answer
if (asksThePerson(payload.last_assistant_message)) process.exit(0);

// A change abandoned inside build, verify or e2e
// A loop station (tweak) hands the turn back after every edit: that is how it works, not an abandoned station
const active = loadLedger(root).changes.find((change) => change.status === "open" && !change.paused && WRITING_STATIONS.has(change.station ?? "") && !LOOP_STATIONS.has(change.station ?? ""));
if (active) block(`Change ${active.id} is inside station "${active.station}". Finish the station, or run \`moku-rails pause --reason "<why>"\` if you are waiting for the user.`);

// A build wave still marked active in the human-readable state
const state = join(root, ".planning", "STATE.md");
const waveActive = existsSync(state) && /\|\s*(active|building|in-progress)\s*\|/.test(readFileSync(state, "utf8"));
if (waveActive && !pausedForUser(root)) block("A build wave is still active in .planning/STATE.md. Complete it, or pause the change if you are waiting for the user.");

/**
 * True when work started from the station is still running: agents recorded by the SubagentStart hook under
 * `.planning/agents/`, or any task the harness lists in the payload's `background_tasks` (an agent or a
 * background shell command; its end wakes the session).
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} hookPayload
 */
function waitingForWork(projectRoot, hookPayload) {
  if (runningAgents(projectRoot).length > 0) return true;

  const tasks = Array.isArray(hookPayload.background_tasks) ? hookPayload.background_tasks : [];
  return tasks.some((task) => task && typeof task === "object");
}

/**
 * True when the turn's last words end on a question to the person.
 *
 * @param {unknown} message the payload's `last_assistant_message`
 */
function asksThePerson(message) {
  return typeof message === "string" && /\?\s*$/.test(message.replace(/[`*_)\]]+\s*$/, ""));
}

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
