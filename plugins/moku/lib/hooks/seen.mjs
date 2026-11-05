/**
 * The rails standing a session was last shown, so the prompt hook repeats it only when it changed.
 *
 * One small file per session under `.planning/agents/seen/`, holding a hash of the status lines. The
 * session hook writes it on every start, compaction included (the model lost what it saw, so it is shown
 * again and remembered anew); the prompt hook compares against it. A session without an id always sees
 * the standing.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { STALE_AFTER_MS } from "./agents.mjs";

const SEEN_DIR = join(".planning", "agents", "seen");

/**
 * Whether these status lines differ from what the session was last shown.
 *
 * @param {string} root project root
 * @param {unknown} session the payload's `session_id`
 * @param {string[]} lines the status lines
 * @returns {boolean} true when the session has not seen them, or cannot be told apart
 * @example
 * if (statusChanged(root, payload.session_id, report.lines)) console.log(report.lines.join("\n"));
 */
export function statusChanged(root, session, lines) {
  if (typeof session !== "string" || session === "") return true;

  try {
    return readFileSync(seenFile(root, session), "utf8").trim() !== digest(lines);
  } catch {
    return true;
  }
}

/**
 * Remember the status lines the session was shown. Records of sessions idle past `STALE_AFTER_MS` go on the way.
 *
 * @param {string} root project root
 * @param {unknown} session the payload's `session_id`
 * @param {string[]} lines the status lines
 * @example
 * rememberStatus(root, payload.session_id, report.lines);
 */
export function rememberStatus(root, session, lines) {
  if (typeof session !== "string" || session === "") return;

  try {
    const dir = join(root, SEEN_DIR);
    mkdirSync(dir, { recursive: true });
    for (const file of readdirSync(dir)) {
      if (Date.now() - statSync(join(dir, file)).mtimeMs > STALE_AFTER_MS) rmSync(join(dir, file), { force: true });
    }
    writeFileSync(seenFile(root, session), `${digest(lines)}\n`);
  } catch {
    /* a read-only checkout only loses the dedup: the standing is shown again next time */
  }
}

/** @param {string[]} lines @returns {string} */
function digest(lines) {
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/** @param {string} root @param {string} session @returns {string} */
function seenFile(root, session) {
  return join(root, SEEN_DIR, `${session.replace(/[^\w-]/g, "_")}.txt`);
}
