#!/usr/bin/env node
/**
 * UserPromptSubmit hook: every request of the person is placed on the route before code follows it.
 *
 * On the rails: a typed message of the person is marked as not routed (the write gate refuses source until
 * a rails command routes it) and the model gets the project's standing plus the routing rule, so the
 * conductor's first step does not depend on the model remembering to load a skill.
 * A prompt the harness wrote (a subagent's hand-back, a task notification, a CI event, a comment relay, a
 * teammate message, a subagent's own spawn prompt) is not a request: the routing flag stays as it is, so
 * builders running in the background keep their gate open, and nothing is printed, so the standing and the
 * routing rule appear once per typed message and never on an agent's reply. The one exception: a hand-back
 * that says an agent produced no report gets the one resume instruction, and a task notification that arrives
 * while other agents of this session still run gets the batching line: one short reply, the reports taken together
 * when the last one is in.
 * The standing itself is repeated only when it changed since the session last saw it (here or at session
 * start, compaction included); the routing rule comes with every typed message.
 * Off the rails: silent, except for one hint when the person names moku, and the line for a request to save or
 * restore the sessions of the desktop app, which is the only thing that saves them: nothing saves on its own.
 */

import { fileURLToPath } from "node:url";

import { RESUME_INSTRUCTION, describeAgents, runningAgents } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { isSubagent, isSystemPrompt, promptText } from "../lib/hooks/origin.mjs";
import { appSessionsOnly, asksToResume, asksToSave } from "../lib/hooks/resume-words.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { rememberStatus, statusChanged } from "../lib/hooks/seen.mjs";
import { latestCheckpoint, readCheckpoint } from "../lib/rails/checkpoint.mjs";
import { status } from "../lib/rails/commands.mjs";
import { loadLedger, markPrompt } from "../lib/rails/ledger.mjs";
import { LOOP_STATIONS } from "../lib/rails/routes.mjs";
import { takeSplitOffer } from "../lib/rails/stages.mjs";

/** The person asks for the restore in so many words: "restore the sessions", "восстанови сессии". */
const RESUME = [
  /\b(restore|resume|continue|bring\s+back|reopen)\s+(all\s+|my\s+|the\s+|open\s+|saved\s+)*(moku\s+)?sessions\b/i,
  /(восстанови|восстановить|продолжи|продолжить|верни|вернуть|подними|поднять|разверни|развернуть|открой)\w*\s+[^.?!\n]{0,30}сесси/i,
];

/** This plugin's CLI, by absolute path: a line run elsewhere must not depend on PATH. */
const RAILS_BIN = fileURLToPath(new URL("../bin/moku-rails", import.meta.url));

const SAVE_HINT = `The person asks to save the sessions. Saving happens only on such a request, never on its own. Run \`${RAILS_BIN} checkpoint\` with Bash now: it saves exactly the sessions of the app's sidebar (this account, not archived) with their nesting, titles, folders, worktrees, branches and permission modes. If the person named sessions to leave out, pass \`--drop <local ids, comma-separated>\`. In your last message, say how many sessions were saved and show them as the tree it prints (titles, nested as in the sidebar), with its "Left out" line, and tell the person that after the new sign-in they say "restore the sessions" («восстанови сессии») in any session and you restore them with your tools; they run nothing. If the command fails, say plainly that nothing was saved and why. \`pause\` does not save the sessions; but if a change is open inside a station, also run \`moku-rails pause --reason "signing in again"\` so the turn can end. Never sign in or out yourself, and never read a token, \`.credentials.json\` or the Keychain.`;

const RESTORE_HINT = (/** @type {string} */ file, /** @type {string} */ savedAt) =>
  `The person asks to restore the saved sessions: the checkpoint ${file}, saved ${savedAt}. Do it yourself with your tools; the person runs nothing. 1) Run \`${RAILS_BIN} resume-checkpoint --json\` with Bash. 2) Make the calls of data.steps in order, exactly as given: unarchive_session; run_in_terminal for the \`--open\` line (the app's Terminal panel, never Bash), then read_terminal until a line starts with "Opened"; when a restart is needed, ask the AskUserQuestion of the steps once and, only on a yes, run its \`--offline-in-terminal\` line yourself (never tell the person they may have to run a command: if the line fails, say what failed and that nothing was written); set_session_title; send_message, then the \`--sent\` line. 3) Run \`--json\` again after each phase, and stop when data.done is true. Never edit the app's files yourself and never archive a session during a restore: the steps do both safely. Say the sessions are restored only when data.done is true; otherwise name each session of data.sessions that still has problems, with its reason. Never sign in or out, and never read a token, \`.credentials.json\` or the Keychain.`;

/**
 * The line for a prompt that asks to save or to restore the sessions, or undefined. A restore is offered only while
 * a checkpoint is on this machine; without one these words are ordinary work.
 *
 * @param {string} text the person's prompt
 * @returns {string | undefined}
 * @example
 * sessionsHint("сохрани сессии"); // "The person asks to save the sessions. …"
 */
function sessionsHint(text) {
  if (/\bmoku-rails\s+checkpoint\b/.test(text) || asksToSave(text)) return SAVE_HINT;

  const restores = /\bmoku-rails\s+resume-checkpoint\b/.test(text) || asksToResume(text) || (RESUME.some((pattern) => pattern.test(text)) && !appSessionsOnly(text));
  if (!restores) return undefined;
  const file = latestCheckpoint();
  const saved = file ? readCheckpoint(file) : undefined;
  return file && saved ? RESTORE_HINT(file, saved.savedAt) : undefined;
}

/**
 * The batching line for a task notification that arrives while other agents of the same session still run, else
 * undefined. A notification of anything else (a shell command, a workflow) and a session with nothing left running
 * get nothing.
 *
 * @param {string} projectRoot
 * @param {unknown} sessionId the session the notification woke
 * @param {string} text the prompt the harness wrote
 * @returns {string | undefined}
 * @example
 * batchHint(root, "s1", "<task-notification>…"); // "moku: 2 agent(s) running: moku:moku-builder ×2 …"
 */
function batchHint(projectRoot, sessionId, text) {
  if (!/<task-notification\b/.test(text)) return undefined;

  const others = runningAgents(projectRoot).filter((agent) => !agent.session || agent.session === sessionId);
  if (others.length === 0) return undefined;

  return `moku: this report is one of a batch, and ${describeAgents(others)} in this session. Do not act on it yet: reply in one short line ("got <agent>, waiting for ${others.length}") with no tool calls and end the turn. Read and act on all the reports together when the last one is in. Every wake-up re-reads the whole conversation, so one per batch is the price, not one per agent. A report that says FAIL or blocks the others is the exception: act on it now.`;
}

const { payload } = readHookInput();
const prompt = promptText(payload);
const root = rootForSession(payload);

if (railsMode() === "off") process.exit(0);

// A prompt the harness wrote is not a new request: nothing is re-routed, no gate closes, nothing is repeated
if (isSystemPrompt(payload)) {
  const noReport = /produced no report|without (a|its) report|no report|marked as partial|reached (its |the )?(max(imum)? )?turn|turn limit|maxTurns/i.test(prompt);
  if (root && noReport) console.log(`moku: an agent ended without its report. ${RESUME_INSTRUCTION}`);

  // A background builder cut off at its turn limit: its hand-back brings the stages offer, once
  const offer = root ? takeSplitOffer(root) : undefined;
  if (offer) console.log(offer);

  // Every wake-up re-reads the whole conversation: while siblings still run, the reports are taken in one batch
  const batch = root && !noReport && !isSubagent(payload) ? batchHint(root, payload.session_id, prompt) : undefined;
  if (batch) console.log(batch);
  process.exit(0);
}

// The sessions of the app, saved or restored on request, on the rails or off them
const sessions = sessionsHint(prompt);

// Off the rails: other projects are never disturbed, except a request to save or restore the sessions
if (!root) {
  if (sessions) {
    console.log(sessions);
    process.exit(0);
  }
  const namesMoku = /\bmoku\b/i.test(prompt) && !/^\s*\/moku:session\b/.test(prompt);
  if (namesMoku) console.log("The person mentions moku, and this directory is not on the moku rails. If they want to build, change or fix something on moku here, run the `moku:session` skill first and write no files before it, even when they say to skip setup: the session is not setup, it is the gate that checks the write. If they only ask a question, answer it, also a \"how do I\" about their own project: explain first, from the skill that owns the topic (`moku-release` for CI and publishing), and start a session only when they ask you to do the work here. A request to show or write an example (a plugin, an island, a snippet) where no project exists in this directory is a question too: answer it in the reply from the framework\'s knowledge skill (`moku-core`, `moku-plugin`, `moku-web`, `moku-game` and the other packs), start no session and create no project unless they ask for one here.");
  process.exit(0);
}

// On the rails: the person's request starts unrouted
markPrompt(root);

// Inside the tweak station every request is the next quick edit: one line, and no routing ceremony
const tweaking = loadLedger(root).changes.find((change) => change.status === "open" && LOOP_STATIONS.has(change.station ?? ""));
if (tweaking) {
  console.log(`Moku rails: ${tweaking.id} is inside "tweak". This request is the next quick edit: make it as the \`moku:tweak\` skill says, with no routing and no checks in between. When the person says the edits are right, run \`moku-rails done tweak\` and the verify station.`);
  process.exit(0);
}

const report = status({ root, positional: [], flags: {} });
const changed = statusChanged(root, payload.session_id, report.lines);
if (changed) rememberStatus(root, payload.session_id, report.lines);

console.log(
  [
    ...(changed ? [`Moku rails (${root}):`, ...report.lines] : [`Moku rails (${root}): standing unchanged since it was last shown (\`moku-rails status\` prints it).`]),
    "Route this request before acting on it. Load the `moku:moku` skill with the Skill tool unless it is already loaded in this conversation, and follow it.",
    "A question needs no routing. Work does: `moku-rails open` for a new change, `moku-rails enter <station>` for the next station, `moku-rails continue` to finish work of the current station, `moku-rails scope \"<what is new>\"` when the person adds something the plan does not cover.",
    "Source writes are refused until one of these ran. Stations run through their skills (brainstorm, design, plan, build, verify, e2e), not by hand.",
    ...(sessions ? [sessions] : []),
  ].join("\n"),
);
