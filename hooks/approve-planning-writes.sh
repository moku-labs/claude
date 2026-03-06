#!/usr/bin/env bash
# Auto-approve writes to .planning/ directory for frictionless state tracking.
# This hook receives the tool input as $1 and checks if the file path
# targets the .planning/ directory (STATE.md, decisions.md, research.md).

INPUT="$1"

# Extract file_path from the JSON input (jq preferred, grep/sed fallback)
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check if the path contains .planning/
if echo "$FILE_PATH" | grep -q '\.planning/'; then
  echo '{"decision":"approve","reason":"Auto-approved: .planning/ directory write for state tracking"}'
  exit 0
fi

# For non-.planning/ paths, don't interfere (let normal permission flow handle it)
exit 0
