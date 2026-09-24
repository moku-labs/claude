#!/usr/bin/env node
/**
 * SessionStart hook: tell the conductor where the project stands, once per session.
 *
 * Silent in every directory that is not on the rails. A git worktree first gets a link to the main
 * checkout's `.planning/`, so the worktree is on the same rails.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { linkPlanning } from "../lib/hooks/worktree.mjs";
import { status } from "../lib/rails/commands.mjs";

const { payload } = readHookInput();
linkPlanning(payload.cwd ?? process.cwd());
const root = rootForSession(payload);

if (!root) process.exit(0);

const report = status({ root, positional: [], flags: {} });
console.log(["Moku rails:", ...report.lines, "The `moku` skill (the conductor) drives the lifecycle from here."].join("\n"));
