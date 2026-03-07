#!/usr/bin/env bash
# UserPromptSubmit hook: inject compact Moku project context before every prompt.
# Keeps output under 200 tokens to minimize context consumption.

# Quick exit if not a Moku project
[ -f src/config.ts ] && grep -q 'createCoreConfig\|@moku-labs' src/config.ts 2>/dev/null && PROJECT_TYPE="Framework" || {
  [ -f package.json ] && grep -q 'createApp' src/index.ts 2>/dev/null && PROJECT_TYPE="Consumer" || {
    [ -f biome.json ] && [ -f vitest.config.ts ] && [ -f package.json ] && grep -q '@moku-labs' package.json 2>/dev/null && PROJECT_TYPE="Tools" || exit 0
  }
}

echo "Moku $PROJECT_TYPE project."

# Plugin count and names (Framework only)
if [ "$PROJECT_TYPE" = "Framework" ] && [ -d src/plugins ]; then
  PLUGINS=$(ls src/plugins/ 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
  PLUGIN_COUNT=$(ls -d src/plugins/*/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PLUGIN_COUNT" -gt 0 ]; then
    echo "Plugins ($PLUGIN_COUNT): $PLUGINS"
  fi
fi

# Planning state
if [ -f .planning/STATE.md ]; then
  PHASE=$(grep '^## Phase:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Phase: //')
  NEXT=$(grep '^## Next Action:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Next Action: //')
  [ -n "$PHASE" ] && echo "Plan: $PHASE"
  [ -n "$NEXT" ] && echo "Next: $NEXT"
fi

exit 0
