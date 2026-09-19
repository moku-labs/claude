/**
 * Which project a hook acts on. One rule for every hook, so they never disagree:
 * the nearest directory on the rails at or above the target. No such directory means the hook stays silent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { findRoot } from "../rails/ledger.mjs";

const SESSION_START = /moku-rails\s+session\s+start\b[^;&|]*?--root[\s=]+("[^"]+"|'[^']+'|[^\s;&|]+)/;

/**
 * The project that owns a file, found from the file's own location, not from the session's cwd.
 *
 * @param {Record<string, any>} payload hook payload
 * @param {string} filePath absolute, or relative to the session cwd
 * @returns {string | undefined}
 * @example
 * rootForFile({ cwd: "/work" }, "/work/site/src/app.ts"); // "/work/site"
 */
export function rootForFile(payload, filePath) {
  return findRoot(dirname(resolve(sessionCwd(payload), filePath)));
}

/**
 * The project a session works in: the cwd when it is on the rails, otherwise the directory this session
 * started with `moku-rails session start --root <dir>`.
 *
 * @param {Record<string, any>} payload hook payload
 * @returns {string | undefined}
 * @example
 * rootForSession({ cwd: "/work/site", session_id: "abc" }); // "/work/site"
 */
export function rootForSession(payload) {
  return findRoot(sessionCwd(payload)) ?? boundRoot(payload.session_id);
}

/**
 * Remember the directory a session started in another folder, so the prompt and stop hooks find it
 * although the session's cwd is somewhere above it. Called by the Bash hook when it sees the start command.
 *
 * @param {Record<string, any>} payload hook payload with `session_id`, `cwd` and the Bash command
 * @example
 * bindSession({ session_id: "abc", cwd: "/work", tool_input: { command: "moku-rails session start --root site" } });
 */
export function bindSession(payload) {
  const target = SESSION_START.exec(String(payload.tool_input?.command ?? ""))?.[1];
  if (!target || typeof payload.session_id !== "string") return;

  const file = bindingFile(payload.session_id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ root: resolve(sessionCwd(payload), target.replace(/^["']|["']$/g, "")) })}\n`);
}

/**
 * @param {unknown} sessionId
 * @returns {string | undefined}
 */
function boundRoot(sessionId) {
  if (typeof sessionId !== "string" || !existsSync(bindingFile(sessionId))) return undefined;

  // A binding that cannot be read, or whose directory left the rails, is no binding
  try {
    return findRoot(JSON.parse(readFileSync(bindingFile(sessionId), "utf8")).root);
  } catch {
    return undefined;
  }
}

/**
 * @param {string} sessionId
 * @returns {string}
 */
function bindingFile(sessionId) {
  const home = process.env.MOKU_HOME ?? join(homedir(), ".claude", "moku");

  return join(home, "sessions", `${sessionId.replace(/[^\w-]/g, "_")}.json`);
}

/**
 * @param {Record<string, any>} payload
 * @returns {string}
 */
function sessionCwd(payload) {
  return typeof payload.cwd === "string" ? payload.cwd : process.cwd();
}
