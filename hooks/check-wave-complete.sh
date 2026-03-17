#!/usr/bin/env bash
# Stop hook: prevent Claude from stopping mid-wave during builds.
# Checks STATE.md for active/in-progress waves and skeleton builds.
# CRITICAL: Checks stop_hook_active first to prevent infinite loops.

# Quick exit if no planning state
[ -f .planning/STATE.md ] || exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# --- Parse stop_hook_active (MUST check first to prevent infinite loops) ---
STOP_HOOK_ACTIVE="false"
if command -v jq &>/dev/null; then
  STOP_HOOK_ACTIVE=$(jq -r '.stop_hook_active // "false"' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  STOP_HOOK_ACTIVE=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(str(d.get('stop_hook_active', False)).lower())
" <<< "$INPUT" 2>/dev/null)
fi

# If Claude is already continuing from a previous stop hook, allow the stop
# Without this check, Claude would be stuck in an infinite loop
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# --- Check for active wave in STATE.md ---
ACTIVE_WAVE=$(grep -E '\|\s*(active|building|in-progress)\s*\|' .planning/STATE.md 2>/dev/null | head -1)

if [ -n "$ACTIVE_WAVE" ]; then
  # Extract wave identifier for the reason message
  WAVE_ID=$(printf '%s' "$ACTIVE_WAVE" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
  [ -z "$WAVE_ID" ] && WAVE_ID="current"

  REASON="Wave $WAVE_ID is still active. Complete the current wave before stopping. Check .planning/STATE.md for remaining tasks."
  log_diagnostic "STOP-BLOCK" "wave:$WAVE_ID" "Prevented stop — wave still active"

  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

# --- Check for in-progress skeleton build ---
SKELETON_STATUS=$(grep '^## Skeleton:' .planning/STATE.md 2>/dev/null | sed 's/## Skeleton: //' | tr -d ' ')

if [ "$SKELETON_STATUS" = "in-progress" ]; then
  REASON="Skeleton build is in-progress. Complete the current skeleton wave before stopping."
  log_diagnostic "STOP-BLOCK" "skeleton" "Prevented stop — skeleton build in-progress"

  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

# No active work — allow stop
exit 0
