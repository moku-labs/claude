#!/usr/bin/env node
/**
 * SubagentStart hook for `moku-builder` and `moku-builder-deep`: take the type-check baseline the builder's stop
 * is compared with, so errors the tree had before the builder are never blamed on it.
 *
 * The `tsc` runs in a detached process and the builder never waits for it; builders of one wave share one run.
 * Silent off the rails, without the project's own `tsc`, and with `MOKU_BUILDER_CHECK=off`.
 */

import { BUILDER, startBaseline } from "../lib/hooks/builder-check.mjs";
import { readHookInput } from "../lib/hooks/input.mjs";
import { rootForSession } from "../lib/hooks/root.mjs";

const { payload } = readHookInput();
const root = rootForSession(payload);
const agentId = String(payload.agent_id ?? "");

if (!root || !agentId || !BUILDER.test(String(payload.agent_type ?? "")) || process.env.MOKU_BUILDER_CHECK === "off") process.exit(0);

try {
  startBaseline(root, agentId);
} catch {
  /* without a baseline the stop hook falls back to the files git sees changed */
}
