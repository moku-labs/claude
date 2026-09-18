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

# Block writes outside .planning/ during brainstorm.
# Build the deny JSON with jq/python3 (NOT string interpolation) so a file path containing a
# double-quote can't produce malformed JSON — a malformed deny would be dropped and the guard would
# fail OPEN. Self-correcting reason: tell Claude what to do instead (see references/hook-patterns.md).
REASON="Brainstorm mode is active — writes are restricted to .planning/. To continue: write exploration/decisions to .planning/ (e.g. the context or position file) instead of ${REL_PATH}. Source/test changes belong to /moku:build; if you meant to leave brainstorm, finish it (the context file is written, then .planning/.brainstorm-active is removed) and run /moku:plan."
if command -v jq &>/dev/null; then
  jq -n --arg r "$REASON" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
elif command -v python3 &>/dev/null; then
  REASON="$REASON" python3 -c 'import os,json; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":os.environ["REASON"]}}))'
  exit 0
else
  # Unreachable in practice (FILE_PATH extraction above already required jq or python3), but
  # fail CLOSED here since we definitively intend to block: exit 2 with a plain reason.
  echo "BLOCKED: $REASON" >&2
  exit 2
fi
