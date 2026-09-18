#!/usr/bin/env bash
# Stop hook, two jobs:
#   1) During moku builds, prevent Claude from stopping mid-wave / mid-skeleton.
#   2) On a genuine stop (agent finished — your turn), play a short completion chime so the user
#      knows it's their turn. Fires in ANY project (gated by enableSounds in moku.local.md).
# CRITICAL: checks stop_hook_active first to prevent infinite loops AND a double-beep on continuation.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true
source "$SCRIPT_DIR/notify.sh" 2>/dev/null || true

INPUT=$(cat)

# --- Parse stop_hook_active (MUST check first) ---
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

# If Claude is already continuing from a previous stop hook, allow the stop silently
# (prevents both an infinite loop and a double-beep).
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# --- Mid-build stop prevention (moku projects only) ---
if [ -f .planning/STATE.md ]; then
  ACTIVE_WAVE=$(grep -E '\|\s*(active|building|in-progress)\s*\|' .planning/STATE.md 2>/dev/null | head -1)
  if [ -n "$ACTIVE_WAVE" ]; then
    WAVE_ID=$(printf '%s' "$ACTIVE_WAVE" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
    [ -z "$WAVE_ID" ] && WAVE_ID="current"
    REASON="Wave $WAVE_ID is still active. Complete the current wave before stopping. Check .planning/STATE.md for remaining tasks."
    log_diagnostic "STOP-BLOCK" "wave:$WAVE_ID" "Prevented stop — wave still active"
    moku_notify "Moku — Stop Blocked" "Wave $WAVE_ID still active" "submarine"
    echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
    exit 0
  fi

  SKELETON_STATUS=$(grep '^## Skeleton:' .planning/STATE.md 2>/dev/null | sed 's/## Skeleton: //' | tr -d ' ')
  if [ "$SKELETON_STATUS" = "in-progress" ]; then
    REASON="Skeleton build is in-progress. Complete the current skeleton wave before stopping."
    log_diagnostic "STOP-BLOCK" "skeleton" "Prevented stop — skeleton build in-progress"
    moku_notify "Moku — Stop Blocked" "Skeleton build in-progress" "submarine"
    echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
    exit 0
  fi
fi

# --- Genuine stop: agent finished, it's the user's turn. Sound only (no popup — Stop fires every
#     turn and a popup each time would be spammy). The chime fires every turn; disable JUST the chime
#     with `enableStopChime: false` (keeps input/permission alerts), or all sound with
#     `enableSounds: false`. ---
STOP_CHIME="true"
if [ -f .claude/moku.local.md ] && grep -qiE '^[[:space:]]*enableStopChime:[[:space:]]*false' .claude/moku.local.md 2>/dev/null; then
  STOP_CHIME="false"
fi
[ "$STOP_CHIME" = "true" ] && moku_sound "glass"
exit 0
