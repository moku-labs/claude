#!/usr/bin/env node
/**
 * PreToolUse hook for Bash: a shell command may not write source files the write gate would refuse.
 *
 * Without it, `cat > src/... <<EOF` walks around the rails. Commands that do not write, or that write
 * outside `src/` or outside this project, pass untouched.
 */

import { homedir } from "node:os";
import { relative, resolve } from "node:path";

import { readHookInput } from "../lib/hooks/input.mjs";
import { railsMode } from "../lib/hooks/mode.mjs";
import { bindSession, rootForSession } from "../lib/hooks/root.mjs";
import { facts } from "../lib/rails/commands.mjs";
import { guardShell } from "../lib/rails/guard.mjs";

const { payload } = readHookInput();
const command = payload.tool_input?.command;
const mode = railsMode();

if (typeof command !== "string" || mode === "off") process.exit(0);

// A session that starts in another directory is remembered, so later hooks find that project
bindSession(payload);

// Off the rails: shell commands pass untouched
const root = rootForSession(payload);
if (!root) process.exit(0);

// A target is judged by where it lands: relative to the session's cwd, then seen from the project root
const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
const locate = (/** @type {string} */ target) => relative(root, resolve(cwd, target.replace(/^~(?=\/|$)/, homedir())));

const verdict = guardShell(command, facts(root), locate);
if (verdict.allow) process.exit(0);

console.error(`moku rails${mode === "warn" ? " (warn)" : ""}: ${verdict.reason}`);
process.exit(mode === "warn" ? 0 : 2);
