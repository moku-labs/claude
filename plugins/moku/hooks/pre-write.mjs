#!/usr/bin/env node
/**
 * PreToolUse hook for Write and Edit: the single gate in front of every file the agent writes.
 *
 * Order: the rails guard first (is this write allowed at all), then the content checks
 * (is what is being written acceptable). The first refusal wins: exit 2 with the reason on stderr.
 */

import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readHookInput } from "../lib/hooks/input.mjs";
import { guardWrite } from "../lib/rails/guard.mjs";
import { isInitialized, isMokuProject, loadLedger } from "../lib/rails/ledger.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOCK = 2;

/** Content checks, each a script that reads the same payload and exits 2 to refuse. */
const CONTENT_CHECKS = ["check-plugin-antipatterns.sh", "validate-common-usage.sh", "validate-plugin-structure.sh", "validate-plugin-index.sh"];

const { raw, payload } = readHookInput();
const filePath = payload.tool_input?.file_path;
const root = payload.cwd ?? process.cwd();

// Nothing to guard without a target file
if (typeof filePath !== "string") process.exit(0);

// Rails: a source file may only arrive at the right station
const mode = process.env.CLAUDE_PLUGIN_OPTION_RAILS ?? "strict";
const verdict = mode === "off" ? { allow: true } : guardWrite(relative(root, resolve(root, filePath)), {
  isMokuProject: isMokuProject(root),
  initialized: isInitialized(root),
  changes: loadLedger(root).changes,
});

if (!verdict.allow && mode === "warn") console.error(`moku rails (warn): ${verdict.reason}`);
if (!verdict.allow && mode === "strict") {
  console.error(`moku rails: ${verdict.reason}`);
  process.exit(BLOCK);
}

// Content: the cheap regex gates that keep known anti-patterns out
for (const script of CONTENT_CHECKS) {
  const run = spawnSync("bash", [join(HERE, script)], { input: raw, cwd: root, encoding: "utf8" });
  if (run.stdout) process.stdout.write(run.stdout);

  if (run.status === BLOCK) {
    process.stderr.write(run.stderr);
    process.exit(BLOCK);
  }
}
