#!/usr/bin/env bash
# A game folder that was scaffolded before the editor's MCP server was part of the template:
# the editor is installed and has its script, but there is no .mcp.json and no .claude/launch.json.
set -euo pipefail
git init -q -b main .
mkdir -p core features/hello shared tests
cat > package.json <<'JSON'
{
  "name": "fruit-drop",
  "type": "module",
  "scripts": { "dev": "moku-game dev", "editor": "moku-editor --root .", "keys": "moku-game keys", "test": "bun --bun vitest run" },
  "dependencies": { "@moku-labs/game": "0.13.0", "pixi.js": "8.6.6" },
  "devDependencies": { "@moku-labs/editor": "0.9.3", "typescript": "6.0.3" }
}
JSON
printf 'import { defineGameApp } from "@moku-labs/game/app";\nimport { game } from "./game";\n\nexport default defineGameApp({ game });\n' > index.ts
printf 'export default { page: { title: "Fruit Drop" } };\n' > config.ts
printf 'export const game = {};\n' > game.ts
printf '.moku\nnode_modules/\ndist/\n' > .gitignore
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
