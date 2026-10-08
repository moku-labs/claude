#!/usr/bin/env bash
# An initialized moku framework on the rails with a plan of three plugin waves and one framework wave.
# Wave 0 is verified. The person asks what is built next and whether it can go in parallel.
set -euo pipefail
git init -q -b main .
mkdir -p src/plugins .planning/specs
printf '{ "name": "site-kit", "type": "module", "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: framework\nname: site-kit\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-10-08-site-kit", "title": "Site kit", "type": "project", "size": "L", "status": "open", "station": "build", "done": ["intake", "plan"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": true, "pauseReason": "wave plan needs approval", "skipped": ["brainstorm", "design"] }], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
cat > .planning/STATE.md <<'MD'
## Phase: build
## Verb: create
## Target: framework
## Skeleton: committed
## Next Action: Run /moku:build resume

## Plugins
| # | Wave | Name | Tier | Dependencies | Spec File | Build Status |
|---|------|------|------|-------------|-----------|--------------|
| 3 | 1 | router | Standard | none | .planning/specs/03-router.md | not started |
| 4 | 1 | content | Complex | env (core) | .planning/specs/04-content.md | not started |
| 5 | 2 | renderer | Complex | router, content | .planning/specs/05-renderer.md | not started |

## Wave Table
| Wave | Plugins | Status |
|------|---------|--------|
| 0 | log, env | verified |
| 1 | router, content | not started |
| 2 | renderer | not started |
| 3 | _framework: src/index.ts exports_ | not started |
MD
for name in 03-router 04-content 05-renderer; do printf '# %s\n\nSpec.\n' "$name" > ".planning/specs/$name.md"; done
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
