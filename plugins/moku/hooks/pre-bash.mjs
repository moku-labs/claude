#!/usr/bin/env node
/**
 * PreToolUse hook for Bash: a shell command may not write source files the write gate would refuse.
 *
 * Without it, `cat > src/... <<EOF` walks around the rails. Commands that do not write, or that write
 * outside `src/`, pass untouched.
 */

import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { facts } from "../lib/rails/commands.mjs";
import { guardShell } from "../lib/rails/guard.mjs";

const { payload } = readHookInput();
const command = payload.tool_input?.command;
const root = payload.cwd ?? process.cwd();
const mode = railsMode();

if (typeof command !== "string" || mode === "off") process.exit(0);

const verdict = guardShell(command, facts(root));
if (verdict.allow) process.exit(0);

console.error(`moku rails${mode === "warn" ? " (warn)" : ""}: ${verdict.reason}`);
process.exit(mode === "warn" ? 0 : 2);
