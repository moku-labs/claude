#!/usr/bin/env bash
# PreToolUse hook: detect common Moku anti-patterns in Write/Edit content.
# Blocks the tool use with a clear error message so Claude can self-correct.

INPUT="$1"

# Extract file_path and content/new_string from JSON input
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.file_path // empty' <<< "$INPUT" 2>/dev/null)
  # For Write tool: content field; for Edit tool: new_string field
  CONTENT=$(jq -r '.content // .new_string // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('file_path',''))" <<< "$INPUT" 2>/dev/null)
  CONTENT=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('content','') or d.get('new_string',''))" <<< "$INPUT" 2>/dev/null)
else
  FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  CONTENT=$(printf '%s' "$INPUT" | grep -o '"content"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"content"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  if [ -z "$CONTENT" ]; then
    CONTENT=$(printf '%s' "$INPUT" | grep -o '"new_string"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"new_string"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  fi
fi

# Only check plugin source files (not specs, not planning files, not tests)
case "$FILE_PATH" in
  */plugins/*) ;;
  */config.ts) ;;
  */index.ts) ;;
  *) exit 0 ;;
esac

# Check 1: Explicit generics on createPlugin (CRITICAL anti-pattern)
if printf '%s\n' "$CONTENT" | grep -q 'createPlugin<'; then
  echo '{"decision":"block","reason":"BLOCKED: Explicit generics on createPlugin detected (e.g. createPlugin<Config, State, ...>). This is a CRITICAL anti-pattern in Moku — all types must be inferred from the spec object. Remove the generic parameters and let TypeScript infer them. See the moku-plugin skill for correct patterns."}'
  exit 0
fi

# No issues found — don't interfere
exit 0
