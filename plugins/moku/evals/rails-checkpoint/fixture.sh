#!/usr/bin/env bash
# A moku consumer app on the rails with a size S fix open at the build station and one file not committed yet.
# The person is about to sign in again with another account and wants the sessions kept.
set -euo pipefail
git init -q -b main .
mkdir -p src/plugins/streak .planning
cat > package.json <<'JSON'
{ "name": "habits", "type": "module", "scripts": { "test": "node -e \"process.exit(0)\"" }, "dependencies": { "@moku-labs/core": "1.7.1" } }
JSON
printf 'type: consumer\nname: habits\ncore_version: 1.7.1\n' > .planning/moku.md
cat > .planning/state.json <<'JSON'
{ "version": 1, "ideas": [], "changes": [{ "id": "2026-11-05-streak-midnight", "title": "Streak resets at midnight", "type": "fix", "size": "S", "status": "open", "station": "build", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }] }
JSON
printf '.planning/\nnode_modules/\n' > .gitignore
cat > src/plugins/streak/index.ts <<'TS'
/**
 * @file The streak plugin: days in a row with a habit done.
 */
export { streakPlugin } from "./plugin";
TS
cat > src/plugins/streak/plugin.ts <<'TS'
import { createPlugin } from "@moku-labs/core";

export const streakPlugin = createPlugin("streak", {
  api: () => ({ days: (dates: string[]) => dates.length }),
});
TS
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
printf 'export const midnight = (date: Date) => date.getHours() === 0;\n' > src/plugins/streak/midnight.ts
# The desktop app of its own, inside the sandbox: two sessions of the current account. The project's settings point
# moku-rails at it, so the eval never reads or writes the person's real app or checkpoints.
# Never over a real app: the eval sandbox's HOME has none, and a real one always keeps its config.json
if [ -e "$(dirname "$PWD")/Library/Application Support/Claude/config.json" ]; then echo "refusing: a real Claude app lives under $(dirname "$PWD")" >&2; exit 1; fi
node - "$PWD" "$(dirname "$PWD")" "${CLAUDE_CODE_ACCOUNT_UUID:-acct}/${CLAUDE_CODE_ORGANIZATION_UUID:-org}" <<'NODE'
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[2];
// The sandbox's HOME is the folder above the project: the app and the checkpoints sit where moku-rails looks by default
const home = process.argv[3];
const account = process.argv[4];
const cur = join(home, "Library", "Application Support", "Claude", "claude-code-sessions", account);
for (const dir of [cur]) mkdirSync(dir, { recursive: true });
const rec = (r) => writeFileSync(join(cur, `${r.sessionId}.json`), JSON.stringify({ isArchived: false, permissionMode: "auto", lastActivityAt: Date.now(), cwd: root, originCwd: root, ...r }));
rec({ sessionId: "local_h1", cliSessionId: "c-habits", title: "Habits: streak fix" });
rec({ sessionId: "local_h2", cliSessionId: "c-tests", title: "Habits: tests", spawnedFrom: { sessionId: "local_h1", sideSession: true } });
writeFileSync(join(home, "Library", "Application Support", "Claude", "git-worktrees.json"), JSON.stringify({ worktrees: {} }));
NODE
# The sandbox may not write under its HOME's .claude: the checkpoints folder there points into the project instead
mkdir -p "$(dirname "$PWD")/.claude" .checkpoints
[ -e "$(dirname "$PWD")/.claude/moku-checkpoints" ] || ln -s "$PWD/.checkpoints" "$(dirname "$PWD")/.claude/moku-checkpoints"
