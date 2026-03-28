#!/usr/bin/env bash
# Blocks writes outside .planning/ during an active brainstorm session.
# The marker file .planning/.brainstorm-active is created by /moku:brainstorm
# at startup and removed at cleanup. If the marker is older than 4 hours,
# it is considered stale (crashed session) and ignored.

# Check if brainstorm is active
MARKER=".planning/.brainstorm-active"
if [ ! -f "$MARKER" ]; then
  exit 0
fi

# Check marker age — ignore if older than 4 hours (stale session)
if command -v stat &>/dev/null; then
  NOW=$(date +%s)
  # macOS stat uses -f %m, Linux uses -c %Y
  MTIME=$(stat -f %m "$MARKER" 2>/dev/null || stat -c %Y "$MARKER" 2>/dev/null || echo "$NOW")
  MARKER_AGE=$(( NOW - MTIME ))
  if [ "$MARKER_AGE" -gt 14400 ]; then
    exit 0
  fi
fi

INPUT=$(cat)

# Extract file_path from JSON input
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('tool_input',{}).get('file_path',''))" <<< "$INPUT" 2>/dev/null)
else
  echo "brainstorm-guard: no jq or python3 available — guard inactive" >&2
  exit 0
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to relative path for matching
REL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" == "$PWD/"* ]]; then
  REL_PATH="${FILE_PATH#$PWD/}"
fi

# Allow writes to .planning/
case "$REL_PATH" in
  .planning/*|*/.planning/*) exit 0 ;;
esac

# Block writes outside .planning/ during brainstorm
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Brainstorm mode active — writes restricted to .planning/ directory. Brainstorm is for exploration and decisions. Use /moku:plan and /moku:build for source code changes."}}'
exit 0
