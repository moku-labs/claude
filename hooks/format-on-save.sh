#!/usr/bin/env bash
# PostToolUse hook: auto-format after Write/Edit if in a Moku project with format script.
# Guards: requires biome.json, package.json with "format" script, node_modules,
# and either a Moku framework marker (src/config.ts) or active planning state (.planning).

[ -f biome.json ] || exit 0
[ -f package.json ] || exit 0
[ -d node_modules ] || exit 0
grep -q '"format"' package.json 2>/dev/null || exit 0

# Must be a Moku project — check for framework marker or active planning
if ! grep -q 'createCoreConfig\|@moku-labs' src/config.ts 2>/dev/null && ! [ -d .planning ]; then
  exit 0
fi

bun run format 2>&1 || echo "Format failed with exit code $?"

exit 0
