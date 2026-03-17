#!/usr/bin/env bash
# SubagentStop hook: auto-save planning state when a build/validation agent completes.
# Captures agent completion with structured decision data into .planning/agent-log.md.
# Extracts verdict, decision, blockers/warnings counts from agent JSON output contracts.

# Only act if we're in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0

INPUT=$(cat)

# Parse agent_type, status, and output in a single pass
# Priority: jq (fast) → python3 (reliable) → skip
if command -v jq &>/dev/null; then
  PARSED=$(jq -r '(.agent_type // "") + "\n" + (.status // "completed") + "\n" + (.output // "")' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  PARSED=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(d.get('agent_type', ''))
print(d.get('status', 'completed'))
print(d.get('output', ''))
" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi
AGENT_TYPE=$(echo "$PARSED" | head -1)
STATUS=$(echo "$PARSED" | sed -n '2p')
OUTPUT=$(echo "$PARSED" | tail -n +3)
[ -z "$STATUS" ] && STATUS="completed"

# Only track moku agents
[ -z "$AGENT_TYPE" ] && exit 0
case "$AGENT_TYPE" in
  moku-*) ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# --- Extract structured data from agent output contract ---
# Agents end their output with a JSON code block containing verdict, blockers, etc.
VERDICT=""
DECISION=""
BLOCKERS_COUNT=""
WARNINGS_COUNT=""

if [ -n "$OUTPUT" ]; then
  # Extract the last JSON block from the output (agent contract is always last)
  JSON_BLOCK=$(printf '%s' "$OUTPUT" | grep -oE '\{[^{}]*"agent"[^{}]*"verdict"[^{}]*\}' 2>/dev/null | tail -1)

  if [ -n "$JSON_BLOCK" ]; then
    if command -v jq &>/dev/null; then
      VERDICT=$(jq -r '.verdict // empty' <<< "$JSON_BLOCK" 2>/dev/null)
      DECISION=$(jq -r '.decision // empty' <<< "$JSON_BLOCK" 2>/dev/null)
      BLOCKERS_COUNT=$(jq -r '.stats.blockers // (.blockers | length) // empty' <<< "$JSON_BLOCK" 2>/dev/null)
      WARNINGS_COUNT=$(jq -r '.stats.warnings // (.warnings | length) // empty' <<< "$JSON_BLOCK" 2>/dev/null)
    elif command -v python3 &>/dev/null; then
      PARSED_CONTRACT=$(python3 -c "
import sys, json
try:
  d = json.loads(sys.stdin.read())
  print(d.get('verdict', ''))
  print(d.get('decision', ''))
  s = d.get('stats', {})
  print(s.get('blockers', len(d.get('blockers', []))))
  print(s.get('warnings', len(d.get('warnings', []))))
except: print('\n\n\n')
" <<< "$JSON_BLOCK" 2>/dev/null)
      VERDICT=$(echo "$PARSED_CONTRACT" | sed -n '1p')
      DECISION=$(echo "$PARSED_CONTRACT" | sed -n '2p')
      BLOCKERS_COUNT=$(echo "$PARSED_CONTRACT" | sed -n '3p')
      WARNINGS_COUNT=$(echo "$PARSED_CONTRACT" | sed -n '4p')
    fi
  fi
fi

# Build the detail column: verdict [decision] B:N W:N
DETAIL="$STATUS"
if [ -n "$VERDICT" ]; then
  DETAIL="$VERDICT"
  [ -n "$DECISION" ] && DETAIL="$DETAIL [$DECISION]"
  [ -n "$BLOCKERS_COUNT" ] && [ "$BLOCKERS_COUNT" != "0" ] && DETAIL="$DETAIL B:$BLOCKERS_COUNT"
  [ -n "$WARNINGS_COUNT" ] && [ "$WARNINGS_COUNT" != "0" ] && DETAIL="$DETAIL W:$WARNINGS_COUNT"
fi

# Append agent completion to log (atomic creation with noclobber to avoid TOCTOU race)
if [ ! -f .planning/agent-log.md ]; then
  (
    set -o noclobber
    {
      echo "# Agent Completion Log"
      echo ""
      echo "| Timestamp | Agent | Result |"
      echo "|-----------|-------|--------|"
    } > .planning/agent-log.md 2>/dev/null || true  # loses race gracefully
  )
fi
AGENT_TYPE="${AGENT_TYPE//|/ }"
DETAIL="${DETAIL//|/ }"
echo "| $TIMESTAMP | $AGENT_TYPE | $DETAIL |" >> .planning/agent-log.md

exit 0
