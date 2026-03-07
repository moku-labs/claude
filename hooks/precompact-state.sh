#!/usr/bin/env bash
# PreCompact hook: re-inject bounded planning state before context compaction.
# Caps output to ~150 lines max to avoid overwhelming the compacted context.
# Also injects minimal project fingerprint when no planning state exists.

# STATE.md: inject headers + plugin table (first 80 lines)
if [ -f .planning/STATE.md ]; then
  echo '## Moku Planning State (re-injected before compaction)'
  head -80 .planning/STATE.md
  echo '... (full state in .planning/STATE.md)'
fi

# decisions.md: inject first 40 lines (key decisions summary)
if [ -f .planning/decisions.md ]; then
  echo ''
  echo '## Moku Decisions (re-injected before compaction)'
  head -40 .planning/decisions.md
fi

# research.md: inject only the summary, not full research
if [ -f .planning/research.md ]; then
  echo ''
  echo '## Moku Research Summary (full in .planning/research.md)'
  head -30 .planning/research.md
fi

# Fallback: inject minimal project fingerprint when no planning state exists
if [ ! -f .planning/STATE.md ] && [ -d src/plugins ] && grep -q 'createCoreConfig\|@moku-labs' src/config.ts 2>/dev/null; then
  echo ''
  echo '## Moku Project Context (re-injected before compaction)'
  FRAMEWORK_ID=$(grep -o 'createCoreConfig.*"[^"]*"' src/config.ts 2>/dev/null | grep -o '"[^"]*"' | head -1 | tr -d '"')
  [ -n "$FRAMEWORK_ID" ] && echo "Framework: $FRAMEWORK_ID"
  PLUGINS=$(ls src/plugins/ 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
  [ -n "$PLUGINS" ] && echo "Plugins: $PLUGINS"
fi

exit 0
