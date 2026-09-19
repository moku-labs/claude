#!/usr/bin/env node
/**
 * SessionStart hook: tell the conductor where the project stands, once per session.
 *
 * Silent in every directory that is not on the rails.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";
import { status } from "../lib/rails/commands.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);

if (!root) process.exit(0);

const report = status({ root, positional: [], flags: {} });
console.log(["Moku rails:", ...report.lines, "The `moku` skill (the conductor) drives the lifecycle from here."].join("\n"));
