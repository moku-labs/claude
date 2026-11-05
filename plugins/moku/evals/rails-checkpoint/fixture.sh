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
