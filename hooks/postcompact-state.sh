#!/usr/bin/env bash
# PostCompact hook: re-inject critical planning state after context compaction.
# Complements precompact-state.sh — ensures STATE.md context survives compaction.

# Only act if planning state exists
[ -f .planning/STATE.md ] || exit 0

# Build context lines from STATE.md key fields
LINES=""
for header in "## Phase:" "## Verb:" "## Target:" "## Next Action:" "## Skeleton:" "## Git Checkpoint:"; do
  val=$(grep "^${header}" .planning/STATE.md 2>/dev/null | head -1)
  [ -n "$val" ] && LINES="${LINES}${val}\n"
done

# Add active/pending wave info (compact)
WAVE=$(awk '/^## Wave Grouping/{f=1;next} f&&/^## /{exit} f&&/\| pending|\| active/{print}' .planning/STATE.md 2>/dev/null | head -3)
[ -n "$WAVE" ] && LINES="${LINES}Active waves:\n${WAVE}\n"

LINES="${LINES}Full state: .planning/STATE.md"

# Output as additionalContext — use python3 for safe JSON encoding
if command -v python3 &>/dev/null; then
  python3 -c "
import json, sys
ctx = sys.stdin.read()
out = {'hookSpecificOutput': {'hookEventName': 'PostCompact', 'additionalContext': 'Moku Planning State (post-compaction):\n' + ctx}}
print(json.dumps(out))
" <<< "$(printf '%b' "$LINES")"
elif command -v jq &>/dev/null; then
  printf '%b' "$LINES" | jq -Rs '{hookSpecificOutput:{hookEventName:"PostCompact",additionalContext:("Moku Planning State (post-compaction):\n" + .)}}'
else
  echo '{"hookSpecificOutput":{"hookEventName":"PostCompact","additionalContext":"Moku state re-injection skipped: neither python3 nor jq available. Check .planning/STATE.md manually."}}'
fi

exit 0
