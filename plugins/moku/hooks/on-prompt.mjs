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
 * Off the rails: silent, except for one hint when the person names moku.
 */

import { RESUME_INSTRUCTION } from "../lib/hooks/agents.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { isSystemPrompt, promptText } from "../lib/hooks/origin.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { status } from "../lib/rails/commands.mjs";
import { loadLedger, markPrompt } from "../lib/rails/ledger.mjs";
import { LOOP_STATIONS } from "../lib/rails/routes.mjs";

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

// Off the rails: other projects are never disturbed
if (!root) {
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
console.log(
  [
    `Moku rails (${root}):`,
    ...report.lines,
    "Route this request before acting on it. Load the `moku:moku` skill with the Skill tool unless it is already loaded in this conversation, and follow it.",
    "A question needs no routing. Work does: `moku-rails open` for a new change, `moku-rails enter <station>` for the next station, `moku-rails continue` to finish work of the current station, `moku-rails scope \"<what is new>\"` when the person adds something the plan does not cover.",
    "Source writes are refused until one of these ran. Stations run through their skills (brainstorm, design, plan, build, verify, e2e), not by hand.",
  ].join("\n"),
);
