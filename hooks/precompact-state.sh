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

  echo '... (full state in .planning/STATE.md, wave history in .planning/STATE-history.md)'
fi

# memory.md: inject structured memory with context-aware relevance + recency priority
if [ -f .planning/memory.md ]; then
  echo ''
  echo '## Moku Project Memory (re-injected before compaction)'

  # Extract task context keywords from STATE.md for relevance filtering
  KEYWORDS=""
  if [ -f .planning/STATE.md ]; then
    # Get current action and phase for keyword extraction
    NEXT_ACTION=$(grep '^## Next Action:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Next Action: //')
    PHASE=$(grep '^## Phase:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Phase: //')
    # Extract plugin names mentioned in next action (e.g., "build router" → "router")
    KEYWORDS=$(echo "$NEXT_ACTION $PHASE" | tr ' /:' '\n' | grep -v '^$' | grep -v '^#' | sort -u | tr '\n' '|' | sed 's/|$//')
  fi

  # Extract each known section with relevance-first, recency-fallback
  for section in "Error Patterns" "Architecture Decisions" "Validation Baselines"; do
    ALL_ENTRIES=$(awk -v sec="## $section" '
      $0 == sec {found=1; next}
      found && /^## /{exit}
      found && /^- \[/ {print}
    ' .planning/memory.md 2>/dev/null)

    if [ -n "$ALL_ENTRIES" ]; then
      echo "## $section"
      if [ -n "$KEYWORDS" ]; then
        # Prioritize keyword-matching entries, then fill remaining slots with recent entries
        # Escape regex metacharacters portably (BSD sed does not support this)
        if command -v python3 &>/dev/null; then
          SAFE_KEYWORDS=$(python3 -c "import re,sys; parts=sys.stdin.read().rstrip('|').split('|'); print('|'.join(re.escape(p) for p in parts if p))" <<< "$KEYWORDS")
        else
          SAFE_KEYWORDS="$KEYWORDS"  # fallback: slight false-positive risk, no crash
        fi
        RELEVANT=$(echo "$ALL_ENTRIES" | grep -iE "${SAFE_KEYWORDS:-__NOMATCH__}" | sort -t'[' -k2 -r | head -3)
        RECENT=$(echo "$ALL_ENTRIES" | sort -t'[' -k2 -r | head -5)
        # Combine: relevant first, then recent (dedup)
        { echo "$RELEVANT"; echo "$RECENT"; } | awk '!seen[$0]++' | head -5
      else
        # No keywords available — pure recency
        echo "$ALL_ENTRIES" | sort -t'[' -k2 -r | head -5
      fi
    fi
  done

  # Fallback: if no structured sections found, inject first 15 lines (legacy format)
  if ! grep -qE '^## Error Patterns|^## Architecture Decisions|^## Validation Baselines' .planning/memory.md 2>/dev/null; then
    head -15 .planning/memory.md
  fi
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
if [ ! -f .planning/STATE.md ] && [ -d src/plugins ] && grep -qE 'createCoreConfig|@moku-labs' src/config.ts 2>/dev/null; then
  echo ''
  echo '## Moku Project Context (re-injected before compaction)'
  FRAMEWORK_ID=$(grep -o 'createCoreConfig.*"[^"]*"' src/config.ts 2>/dev/null | grep -o '"[^"]*"' | head -1 | tr -d '"')
  [ -n "$FRAMEWORK_ID" ] && echo "Framework: $FRAMEWORK_ID"
  PLUGINS=$(ls src/plugins/ 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
  [ -n "$PLUGINS" ] && echo "Plugins: $PLUGINS"
fi

exit 0
