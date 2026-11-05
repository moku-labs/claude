#!/usr/bin/env node
/**
 * SessionStart hook: tell the conductor where the project stands, at every start of a session.
 *
 * A compaction starts the session again (`source: compact`): the model no longer has the standing it was
 * shown, so it gets it in full once more, and the prompt hook takes that as what the session last saw.
 *
 * Silent in every directory that is not on the rails. A git worktree first gets a link to the main
 * checkout's `.planning/`, so the worktree is on the same rails.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { rememberStatus } from "../lib/hooks/seen.mjs";
import { linkPlanning } from "../lib/hooks/worktree.mjs";
import { status } from "../lib/rails/commands.mjs";

const { payload } = readHookInput();
linkPlanning(payload.cwd ?? process.cwd());
const root = rootForSession(payload);

if (!root) process.exit(0);

const report = status({ root, positional: [], flags: {} });
rememberStatus(root, payload.session_id, report.lines);

const header = payload.source === "compact" ? "Moku rails (after compaction, the standing again):" : "Moku rails:";
console.log([header, ...report.lines, "The `moku` skill (the conductor) drives the lifecycle from here."].join("\n"));
