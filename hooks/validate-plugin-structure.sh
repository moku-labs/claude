#!/usr/bin/env bash
# PreToolUse hook: validate plugin directory structure on Write/Edit to plugin files.
# Complements the prompt hook (which checks content) by checking filesystem state.

INPUT="$1"

# Extract file_path from JSON input
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.file_path // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('file_path', ''))" <<< "$INPUT" 2>/dev/null)
else
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

# Check 1: Plugin directory should not have too many .ts source files (excluding tests)
# >12 source files suggests the plugin is too large and should be split
SOURCE_COUNT=$(find "$PLUGIN_DIR" -maxdepth 1 -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$SOURCE_COUNT" -gt 12 ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"WARNING: Plugin '$PLUGIN_NAME' has $SOURCE_COUNT source files — exceeds VeryComplex tier max (12). Consider splitting into sub-plugins.\"}"
  exit 0
fi

# Check 2: Plugin should not have deeply nested subdirectories (max 1 level of sub-modules)
DEEP_DIRS=$(find "$PLUGIN_DIR" -mindepth 2 -maxdepth 2 -type d ! -path '*__tests__*' ! -path '*node_modules*' 2>/dev/null | head -1)
if [ -n "$DEEP_DIRS" ]; then
  echo "{\"decision\":\"warn\",\"reason\":\"WARNING: Plugin '$PLUGIN_NAME' has deeply nested directories. Moku plugins should be flat (1 level of sub-modules max).\"}"
  exit 0
fi

# Check 3: If types.ts exists, verify it's imported (Standard+ pattern)
if [ -f "$PLUGIN_DIR/types.ts" ]; then
  if [ -f "$PLUGIN_DIR/index.ts" ] && ! grep -q 'from.*[./]*types' "$PLUGIN_DIR/index.ts" 2>/dev/null; then
    # Only warn if index.ts already exists and doesn't import types
    # (skip if index.ts is being written for the first time)
    if [ -s "$PLUGIN_DIR/index.ts" ]; then
      echo "{\"decision\":\"warn\",\"reason\":\"WARNING: Plugin '$PLUGIN_NAME' has types.ts but index.ts does not import from it. Standard+ plugins should use types from types.ts.\"}"
      exit 0
    fi
  fi
fi

# No structural issues found
exit 0
