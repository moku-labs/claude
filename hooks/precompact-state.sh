#!/usr/bin/env bash
# PreCompact hook: re-inject bounded planning state before context compaction.
# Uses section-aware extraction to prioritize semantically critical fields,
# regardless of their position in the file. Caps total output to ~150 lines.

# STATE.md: extract critical sections by header (not positional)
if [ -f .planning/STATE.md ]; then
  echo '## Moku Planning State (re-injected before compaction)'

  # Always extract these key headers (single-line values)
  for header in "## Phase:" "## Verb:" "## Target:" "## Next Action:" "## Git Checkpoint:"; do
    line=$(grep "^${header}" .planning/STATE.md 2>/dev/null | head -1)
    [ -n "$line" ] && echo "$line"
  done

  # Extract Completed checklist (multi-line section, up to 20 lines)
  awk '/^## Completed/{found=1; print; next} found && /^## /{exit} found && NR>0{print}' .planning/STATE.md 2>/dev/null | head -20

  # Extract Plugins table (multi-line section, up to 30 lines)
  awk '/^## Plugins/{found=1; print; next} found && /^## /{exit} found && NR>0{print}' .planning/STATE.md 2>/dev/null | head -30

  # Extract Wave Grouping (multi-line section, up to 15 lines)
  awk '/^## Wave Grouping/{found=1; print; next} found && /^## /{exit} found && NR>0{print}' .planning/STATE.md 2>/dev/null | head -15

  # Extract Verification Results if present (up to 10 lines)
  awk '/^## Verification/{found=1; print; next} found && /^## /{exit} found && NR>0{print}' .planning/STATE.md 2>/dev/null | head -10

  echo '... (full state in .planning/STATE.md)'
fi

# memory.md: inject project-level memory (first 30 lines)
if [ -f .planning/memory.md ]; then
  echo ''
  echo '## Moku Project Memory (re-injected before compaction)'
  head -30 .planning/memory.md
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
