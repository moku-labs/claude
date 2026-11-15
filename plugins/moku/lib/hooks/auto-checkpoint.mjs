/**
 * Auto checkpoint: keep a checkpoint of the open sessions without anyone running `moku-rails checkpoint`.
 *
 * One concern: at the end of a turn, at most once in a while, and at once when the person speaks of signing in
 * again, start `moku-rails checkpoint --auto` in the background. The checkpoint writes no file when nothing changed,
 * so the newest file is always the last state worth keeping. Off with `MOKU_AUTO_CHECKPOINT=0`.
 */

import { spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkpointsDir } from "../rails/checkpoint.mjs";

/** The least time between two checkpoints the hook starts on its own. */
export const AUTO_INTERVAL_MS = Number(process.env.MOKU_AUTO_CHECKPOINT_MS ?? 20 * 60 * 1000);

const RAILS_BIN = fileURLToPath(new URL("../../bin/moku-rails", import.meta.url));

/**
 * Start a checkpoint in the background when the last one the hook started is older than the interval, or at once
 * with `force`. Never waits for it and never fails the hook.
 *
 * @param {{ force?: boolean, now?: number, cwd?: string }} [options] `cwd` is the session's folder, whose sessions count
 *   even in a temporary folder
 * @returns {boolean} whether one was started
 * @example
 * autoCheckpoint(); // true at most once in 20 minutes
 */
export function autoCheckpoint({ force = false, now = Date.now(), cwd } = {}) {
  if (process.env.MOKU_AUTO_CHECKPOINT === "0") return false;

  const marker = join(checkpointsDir(), ".auto-last");
  try {
    if (!force && now - statSync(marker).mtimeMs < AUTO_INTERVAL_MS) return false;
  } catch {
    // No marker yet: the first one runs
  }

  try {
    mkdirSync(checkpointsDir(), { recursive: true });
    writeFileSync(marker, `${new Date(now).toISOString()}\n`);
    const child = spawn(process.execPath, [RAILS_BIN, "checkpoint", "--auto", ...(cwd ? ["--root", cwd] : [])], { cwd: homedir(), detached: true, stdio: "ignore", env: { ...process.env, CLAUDECODE: "" } });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
