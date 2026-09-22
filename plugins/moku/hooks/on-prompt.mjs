#!/usr/bin/env node
/**
 * UserPromptSubmit hook: every request of the person is placed on the route before code follows it.
 *
 * On the rails: it marks the request as not routed (the write gate refuses source until a rails command
 * routes it) and hands the model the project's standing plus the routing rule, so the conductor's first
 * step does not depend on the model remembering to load a skill.
 * Off the rails: silent, except for one hint when the person names moku.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { status } from "../lib/rails/commands.mjs";
import { markPrompt } from "../lib/rails/ledger.mjs";

const { payload } = readHookInput();
const prompt = String(payload.prompt ?? "");
const root = rootForSession(payload);

if (railsMode() === "off") process.exit(0);

// Off the rails: other projects are never disturbed
if (!root) {
  const namesMoku = /\bmoku\b/i.test(prompt) && !/^\s*\/moku:session\b/.test(prompt);
  if (namesMoku) console.log("The person mentions moku, and this directory is not on the moku rails. If they want to build, change or fix something on moku here, run the `moku:session` skill first and write no files before it, even when they say to skip setup: the session is not setup, it is the gate that checks the write. If they only ask a question, answer it.");
  process.exit(0);
}

// On the rails: the request starts unrouted
markPrompt(root);

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
