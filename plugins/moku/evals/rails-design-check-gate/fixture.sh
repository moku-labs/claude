#!/usr/bin/env bash
# A change that follows the design "board" sits inside the build station. The code is written, the
# design check never ran: there is no .planning/design/board/check/design-check.md.
set -euo pipefail
git init -q -b main .
mkdir -p src/plugins/board .planning/design/board .planning/specs
printf '{ "name": "tiles", "type": "module", "scripts": { "test": "node -e \\"process.exit(0)\\"" }, "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: consumer\nname: tiles\ncore_version: 1.7.1\n' > .planning/moku.md
printf '# Board — Design Context\n\nPrototype: .planning/design/board/index.html\n' > .planning/design/board/design-context.md
printf '<!doctype html><div class="tray"></div>\n' > .planning/design/board/index.html
printf '{ "version": 1, "changes": [{ "id": "2026-10-11-board", "title": "The board", "type": "feature", "size": "M", "status": "open", "station": "build", "done": ["intake", "design", "plan"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false, "design": "board" }], "ideas": [] }\n' > .planning/state.json
printf 'export const boardPlugin = {};\n' > src/plugins/board/index.ts
printf '.planning/\nnode_modules/\n' > .gitignore
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
