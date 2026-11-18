/**
 * Preloaded by `npm test`: every test, and every process it spawns, sees a throwaway HOME and
 * CLAUDE_CONFIG_DIR, so no test reads or writes the person's real `~/.claude`. Tests that need their own
 * folders still set them per run.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.MOKU_TEST_HOME) {
  const home = mkdtempSync(join(tmpdir(), "moku-test-home-"));
  process.env.MOKU_TEST_HOME = home;
  process.env.HOME = home;
  process.env.CLAUDE_CONFIG_DIR = join(home, ".claude");
  // The desktop app is never read or written: its folder is the throwaway HOME's, and it counts as closed
  process.env.MOKU_DESKTOP_RUNNING = "0";
  for (const name of ["CLAUDE_CODE_ACCOUNT_UUID", "CLAUDE_CODE_ORGANIZATION_UUID", "CLAUDE_CODE_SESSION_ID", "MOKU_DESKTOP_SESSIONS", "MOKU_DESKTOP_ACCOUNT"]) delete process.env[name];
  // git still needs a name for the commits tests make, and must not read the person's global config
  process.env.GIT_CONFIG_GLOBAL = join(home, ".gitconfig");
  process.env.GIT_AUTHOR_NAME ??= "moku test";
  process.env.GIT_AUTHOR_EMAIL ??= "test@moku.invalid";
  process.env.GIT_COMMITTER_NAME ??= "moku test";
  process.env.GIT_COMMITTER_EMAIL ??= "test@moku.invalid";
}
