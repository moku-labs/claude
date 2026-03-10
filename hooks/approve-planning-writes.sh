#!/usr/bin/env bash
# Auto-approve writes to known .planning/ files for frictionless state tracking.
# Restricted to specific known filenames to prevent bypass of anti-pattern checks
# on arbitrary files placed under .planning/.

INPUT="$1"

# Extract file_path from the JSON input
# Priority: jq (fast) → python3 (reliable) → skip
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.file_path // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('file_path',''))" <<< "$INPUT" 2>/dev/null)
else
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

# Allow-list of known .planning/ files and patterns
case "$REL_PATH" in
  .planning/STATE.md|.planning/STATE.md.bak)
    ;;
  .planning/decisions.md|.planning/research.md|.planning/memory.md)
    ;;
  .planning/agent-log.md|.planning/notifications.log)
    ;;
  .planning/app-spec.md)
    ;;
  .planning/specs/*.md)
    ;;
  *)
    # Not a known .planning/ file — don't auto-approve, let normal flow handle it
    exit 0
    ;;
esac

echo '{"decision":"approve","reason":"Auto-approved: known .planning/ file for state tracking"}'
exit 0
