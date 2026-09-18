#!/usr/bin/env node
/**
 * SessionStart hook: tell the conductor where the project stands, once per session.
 *
 * Silent outside moku projects.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { status } from "../lib/rails/commands.mjs";
import { isMokuProject } from "../lib/rails/ledger.mjs";

const { payload } = readHookInput();
const root = payload.cwd ?? process.cwd();

if (!isMokuProject(root)) process.exit(0);

const report = status({ root, positional: [], flags: {} });
console.log(["Moku rails:", ...report.lines, "The `moku` skill (the conductor) drives the lifecycle from here."].join("\n"));
