#!/usr/bin/env bash
# PreToolUse hook: validate plugin directory structure on Write/Edit to plugin files.
# Complements the anti-pattern hook by checking filesystem state.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# Quick exit if not a Moku project
[ -f .planning/moku.md ] || exit 0

# Extract file_path from JSON input (nested under tool_input)
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('tool_input',{}).get('file_path',''))" <<< "$INPUT" 2>/dev/null)
else
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"WARNING: Plugin structure check skipped — neither jq nor python3 available. Install one for Moku hook support."}}'
  exit 0
fi

# Only check plugin source files
case "$FILE_PATH" in
  */plugins/*/index.ts) ;;
  *) exit 0 ;;
esac

# Extract plugin directory from file path
PLUGIN_DIR=$(dirname "$FILE_PATH")
PLUGIN_NAME=$(basename "$PLUGIN_DIR")

# Helper: emit additionalContext with safe JSON encoding
emit_warning() {
  if command -v jq &>/dev/null; then
    printf '%s' "$1" | jq -Rs '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:.}}'
  elif command -v python3 &>/dev/null; then
    python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','additionalContext':sys.stdin.read()}}))" <<< "$1"
  else
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"WARNING: Plugin structure issue detected. Check plugin directory manually.\"}}"
  fi
}

# Check 1: too many DOMAIN source files suggests the plugin is too large.
# Count domain files only — exclude tests AND wiring/entry files (index.ts, client.ts, lifecycle.ts)
# which are structural, not domain concerns. A legitimate Complex SPA (client entry + lifecycle
# teardown split) was previously flagged at 13 flat files; excluding entry files fixes that.
SOURCE_COUNT=$(find "$PLUGIN_DIR" -maxdepth 1 -name '*.ts' \
  -not -name '*.test.ts' -not -name '*.spec.ts' \
  -not -name 'index.ts' -not -name 'client.ts' -not -name 'lifecycle.ts' \
  -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$SOURCE_COUNT" -gt 12 ]; then
  log_diagnostic "STRUCTURE" "$PLUGIN_NAME" "$SOURCE_COUNT domain files — exceeds VeryComplex tier max (12)"
  emit_warning "WARNING: Plugin '$PLUGIN_NAME' has $SOURCE_COUNT domain source files (excluding index/client/lifecycle entry files) — exceeds VeryComplex tier max (12). Consider splitting into sub-modules or sub-plugins."
  exit 0
fi

# Check 2: Plugin should not have deeply nested subdirectories (max 1 level of sub-modules)
DEEP_DIRS=$(find "$PLUGIN_DIR" -mindepth 2 -maxdepth 2 -type d \
  ! -path '*__tests__*' ! -path '*/tests/*' ! -path '*/spec*' ! -path '*node_modules*' 2>/dev/null | head -1)
if [ -n "$DEEP_DIRS" ]; then
  log_diagnostic "STRUCTURE" "$PLUGIN_NAME" "deeply nested directories detected"
  emit_warning "WARNING: Plugin '$PLUGIN_NAME' has deeply nested directories. Moku plugins should be flat (1 level of sub-modules max)."
  exit 0
fi

# Check 3: If types.ts exists, verify it's consumed — EITHER imported locally in index.ts OR
# re-exported via the plugins barrel (src/plugins/index.ts `export … from "./<name>/types"`).
# The barrel-export path is the standard way types are surfaced, so recognizing it avoids a
# pervasive false "types.ts not imported" warning.
if [ -f "$PLUGIN_DIR/types.ts" ] && [ -s "$PLUGIN_DIR/index.ts" ]; then
  IMPORTED_LOCALLY=no
  grep -qE "from ['\"][./]*types['\"]" "$PLUGIN_DIR/index.ts" 2>/dev/null && IMPORTED_LOCALLY=yes
  BARREL="$(dirname "$PLUGIN_DIR")/index.ts"
  EXPORTED_VIA_BARREL=no
  [ -f "$BARREL" ] && grep -qE "from ['\"]\./$PLUGIN_NAME/types['\"]" "$BARREL" 2>/dev/null && EXPORTED_VIA_BARREL=yes
  if [ "$IMPORTED_LOCALLY" = "no" ] && [ "$EXPORTED_VIA_BARREL" = "no" ]; then
    log_diagnostic "STRUCTURE" "$PLUGIN_NAME" "types.ts exists but neither imported in index.ts nor exported via the plugins barrel"
    emit_warning "WARNING: Plugin '$PLUGIN_NAME' has types.ts but it is neither imported in its index.ts nor re-exported from src/plugins/index.ts (barrel). Wire it one of those two ways."
    exit 0
  fi
fi

# No structural issues found
exit 0
