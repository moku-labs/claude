#!/usr/bin/env bash
# An initialized moku consumer app on the rails, with one plugin that draws a HUD.
# The person asks for one small edit and says more will follow.
set -euo pipefail
git init -q -b main .
mkdir -p src/plugins/hud .planning
cat > package.json <<'JSON'
{ "name": "habits", "type": "module", "scripts": { "test": "node -e \"process.exit(0)\"" }, "dependencies": { "@moku-labs/core": "1.7.1" } }
JSON
printf 'type: consumer\nname: habits\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
cat > src/plugins/hud/index.ts <<'TS'
/**
 * @file The HUD plugin: the score line at the top of the screen.
 */
export { hudPlugin } from "./plugin";
TS
cat > src/plugins/hud/plugin.ts <<'TS'
import { createPlugin } from "@moku-labs/core";

import { scoreLine } from "./view";

export const hudPlugin = createPlugin("hud", {
  api: () => ({ line: (score: number) => scoreLine(score) }),
});
TS
cat > src/plugins/hud/view.ts <<'TS'
/**
 * The text of the score line.
 *
 * @param score - the player's score
 * @returns the line as the HUD shows it
 * @example
 * scoreLine(12); // "Score: 12"
 */
export function scoreLine(score: number): string {
  return `Score: ${score}`;
}
TS
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
