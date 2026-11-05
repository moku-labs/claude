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
 * that says an agent produced no report gets the one resume instruction.
 * The standing itself is repeated only when it changed since the session last saw it (here or at session
 * start, compaction included); the routing rule comes with every typed message.
 * Off the rails: silent, except for one hint when the person names moku.
 */

import { statSync } from "node:fs";

import { RESUME_INSTRUCTION } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { isSystemPrompt, promptText } from "../lib/hooks/origin.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { rememberStatus, statusChanged } from "../lib/hooks/seen.mjs";
import { DEFAULT_SINCE_HOURS, latestCheckpoint } from "../lib/rails/checkpoint.mjs";
import { status } from "../lib/rails/commands.mjs";
import { loadLedger, markPrompt } from "../lib/rails/ledger.mjs";
import { LOOP_STATIONS } from "../lib/rails/routes.mjs";

/**
 * The person is about to change their own Claude sign-in: an explicit first-person or "my account" phrase, a re-login,
 * a Claude login command, or a request to keep the sessions. Plain "login", "account" or "вход" never match: a login
 * screen, a user account page or a sign-in form is ordinary app work.
 */
const SIGN_IN = [
  /\b(sign|log)(ging|ged)?[\s-]?(in|on)\s+(again|anew)\b/i,
  /\b(sign|log)(ging|ged)?[\s-]?in\s+(with|to|under|as)\s+my\s+(\w+\s+)?account\b/i,
  /\bI('ll|'m| will| am)?\b[^.?!\n]{0,40}\b(another|other|second|different)\s+(claude\s+)?account\b/i,
  /\b(switch|change|swap)\w*\s+(to\s+)?my\s+(\w+\s+)?account\b|\b(switch|change|swap)\w*\s+(my\s+)?claude\s+accounts?\b/i,
  /\bre-?log(in)?\b|\bclaude\s+(auth\s+)?(login|logout)\b|(^|\s)\/(login|logout)\b/i,
  /\bmoku-rails\s+(resume-)?checkpoint\b|\b(save|keep|checkpoint)\s+(all\s+)?(my|the|all|open)\s+(\w+\s+)?sessions\b/i,
  /перелогин|разлогин|релогин|(войду|зайду|залогинюсь|перейду|переключусь|переключаюсь|выйду|выхожу|сменю|меняю)[^.?!\n]{0,30}аккаунт/i,
  /claude[^.?!\n]{0,20}аккаунт|аккаунт\w*\s+claude|(сохрани|сохранить|чекпо[йи]нт)\w*\s+(все\s+|мои\s+|открытые\s+)*сесси/i,
  // "Save the work" alone is a commit or a pause; it means the checkpoint only beside a sign-in or the sessions
  /\b(save|keep)\s+(my\s+|the\s+|all\s+)*(work|progress)\b[^.?!\n]{0,60}\b(sessions?|sign(ing)?[\s-]?(in|out)|log(ging)?[\s-]?(in|out)|account)\b/i,
  /(сохрани|сохранить|запомни)\w*\s+(всю\s+|мою\s+|текущую\s+)*(работу|прогресс)[^.?!\n]{0,60}(сесси|аккаунт|логин|выход|выйд)/i,
  /(перед|до)\s+(выходом|перелогином|логином|сменой\s+аккаунта)[^.?!\n]{0,40}(сохрани|сохранить)/i,
];

/**
 * The person wants the saved sessions back: "restore the sessions", "continue the work", "восстанови сессии". It means
 * the checkpoint only while a recent one is on this machine; without one these words are ordinary work.
 */
const RESUME = [
  /\b(restore|resume|continue|bring\s+back|reopen)\s+(all\s+|my\s+|the\s+|open\s+|saved\s+)*(moku\s+)?(sessions|work|progress)\b/i,
  /(восстанови|восстановить|продолжи|продолжить|верни|вернуть|подними|поднять|разверни|развернуть|открой)\w*\s+[^.?!\n]{0,30}(сесси|работу|прогресс)/i,
];

const RESUME_HINT = (file) => `A checkpoint of the moku sessions is on this machine (${file}). If the person means those sessions (after signing in again, "restore the sessions"), run \`moku-rails resume-checkpoint\`, and hand over what it prints, one \`claude --resume <id>\` per session with where it stopped, and the background tasks to start again. If they mean the change in front of them ("continue the work on F152"), ignore this line. Never sign in or out yourself, and never read a token, \`.credentials.json\` or the Keychain.`;

/**
 * The newest checkpoint if it is recent enough to resume, else undefined.
 *
 * @returns {string | undefined}
 * @example
 * freshCheckpoint(); // "/Users/ann/.claude/moku-checkpoints/2026-11-05T20-10-00Z.json"
 */
function freshCheckpoint() {
  const file = latestCheckpoint();
  if (!file) return undefined;

  const ageHours = (Date.now() - statSync(file).mtimeMs) / 3_600_000;
  return ageHours <= DEFAULT_SINCE_HOURS ? file : undefined;
}

/**
 * The resume hint when the prompt asks for the saved sessions back and a fresh checkpoint exists.
 *
 * @param {string} text the person's prompt
 * @returns {string | undefined}
 * @example
 * resumeHint("восстанови сессии"); // "A checkpoint of the moku sessions is on this machine (...)..."
 */
function resumeHint(text) {
  if (!RESUME.some((pattern) => pattern.test(text))) return undefined;

  const file = freshCheckpoint();
  return file ? RESUME_HINT(file) : undefined;
}

const CHECKPOINT_HINT = "The person is about to sign in again. Run `moku-rails checkpoint`, not `pause`: it saves every open moku session on this machine (id, folder, where it stopped, background tasks). If a change is open inside a station, also run `moku-rails pause --reason \"signing in again\"` before you answer, so the turn can end. Then, in your last message, tell them to close the sessions, sign in themselves with `claude auth login`, and run `moku-rails resume-checkpoint`, which prints one `claude --resume <id>` per session. Never sign in or out yourself, and never read a token, `.credentials.json` or the Keychain.";

const { payload } = readHookInput();
const prompt = promptText(payload);
const root = rootForSession(payload);

if (railsMode() === "off") process.exit(0);

// A prompt the harness wrote is not a new request: nothing is re-routed, no gate closes, nothing is repeated
if (isSystemPrompt(payload)) {
  const noReport = /produced no report|without (a|its) report|no report|marked as partial|reached (its |the )?(max(imum)? )?turn|turn limit|maxTurns/i.test(prompt);
  if (root && noReport) console.log(`moku: an agent ended without its report. ${RESUME_INSTRUCTION}`);
  process.exit(0);
}

// Off the rails: other projects are never disturbed, except a request for the saved sessions back
if (!root) {
  const hint = resumeHint(prompt);
  if (hint) {
    console.log(hint);
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

// Signing in again ends the sessions: the checkpoint keeps them, a pause keeps only the change
const signingIn = SIGN_IN.some((pattern) => pattern.test(prompt));
const resuming = signingIn ? undefined : resumeHint(prompt);

const report = status({ root, positional: [], flags: {} });
const changed = statusChanged(root, payload.session_id, report.lines);
if (changed) rememberStatus(root, payload.session_id, report.lines);

console.log(
  [
    ...(changed ? [`Moku rails (${root}):`, ...report.lines] : [`Moku rails (${root}): standing unchanged since it was last shown (\`moku-rails status\` prints it).`]),
    "Route this request before acting on it. Load the `moku:moku` skill with the Skill tool unless it is already loaded in this conversation, and follow it.",
    "A question needs no routing. Work does: `moku-rails open` for a new change, `moku-rails enter <station>` for the next station, `moku-rails continue` to finish work of the current station, `moku-rails scope \"<what is new>\"` when the person adds something the plan does not cover.",
    "Source writes are refused until one of these ran. Stations run through their skills (brainstorm, design, plan, build, verify, e2e), not by hand.",
    ...(signingIn ? [CHECKPOINT_HINT] : []),
    ...(resuming ? [resuming] : []),
  ].join("\n"),
);
