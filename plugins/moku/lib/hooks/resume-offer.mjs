/**
 * Resume offer: after the person signs in under another account, the first prompt there brings the offer to restore
 * the saved sessions, even when it does not ask for them.
 *
 * One concern: compare the account a fresh checkpoint was saved from with the account the desktop app works in now,
 * and offer the resume once per checkpoint and account, while some of its Code tab sessions are not open here yet.
 * The account is the folder of the app's records; no credential is read.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkpointFolder, readCheckpoint, reopenedSessions } from "../rails/checkpoint.mjs";
import { currentAccountDir, desktopRoot } from "../rails/desktop.mjs";

/**
 * The offer for the first prompt under a new account, or undefined: no checkpoint of another account, every session
 * open here already, or the offer made once already.
 *
 * @param {string | undefined} file a fresh checkpoint
 * @param {string} rails the `moku-rails` command, by absolute path
 * @returns {string | undefined}
 * @example
 * accountOffer("/Users/ann/.claude/moku-checkpoints/2026-11-08T10-50-35Z.json", "/…/bin/moku-rails");
 * // "The person signed in under another account since the checkpoint … (5 sessions, 5 not open here yet) …"
 */
export function accountOffer(file, rails) {
  const saved = file ? readCheckpoint(file) : undefined;
  if (!file || !saved?.desktopDir) return undefined;

  const root = desktopRoot();
  const current = currentAccountDir(root);
  if (!current || current === saved.desktopDir) return undefined;

  const marker = join(checkpointFolder(saved.savedAt), "offered.json");
  const offered = readOffered(marker);
  if (offered.includes(current)) return undefined;

  const waiting = reopenedSessions(saved, root).filter((entry) => entry.newId && !entry.opened).length;
  if (waiting === 0) return undefined;

  mkdirSync(checkpointFolder(saved.savedAt), { recursive: true });
  writeFileSync(marker, `${JSON.stringify([...offered, current])}\n`);

  return `The person signed in under another account since the checkpoint ${file} (${saved.sessions.length} session${saved.sessions.length === 1 ? "" : "s"}, ${waiting} not open here yet). Answer what they asked first; then, in one line, offer to restore those sessions, and name the command they run with the app open: \`${rails} resume-checkpoint --open\`. Say this once; if they decline, do not bring it up again.`;
}

/**
 * The account folders the offer was made in already.
 *
 * @param {string} marker
 * @returns {string[]}
 */
function readOffered(marker) {
  if (!existsSync(marker)) return [];
  try {
    const list = JSON.parse(readFileSync(marker, "utf8"));
    return Array.isArray(list) ? list.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
