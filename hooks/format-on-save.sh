#!/usr/bin/env bash
# PostToolUse hook: auto-format after Write/Edit if in a Moku project with format script.
# Formats only the changed file (not the entire project) for performance.
# Guards: requires biome.json, package.json with "format" script, node_modules,
# and either a Moku framework marker (src/config.ts) or active planning state (.planning).

[ -f biome.json ] || exit 0
[ -f package.json ] || exit 0
[ -d node_modules ] || exit 0
grep -q '"format"' package.json 2>/dev/null || exit 0

# Must be a Moku project — check for framework marker or active planning
if ! grep -qE 'createCoreConfig|@moku-labs' src/config.ts 2>/dev/null && ! [ -d .planning ]; then
  exit 0
fi

# Extract file path from TOOL_INPUT to format only the changed file
CHANGED_FILE=""
if [ -n "$TOOL_INPUT" ]; then
  if command -v jq &>/dev/null; then
    CHANGED_FILE=$(jq -r '.file_path // empty' <<< "$TOOL_INPUT" 2>/dev/null)
  elif command -v python3 &>/dev/null; then
    CHANGED_FILE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('file_path',''))" <<< "$TOOL_INPUT" 2>/dev/null)
  fi
fi

# Format only the changed file if we extracted a path and it's a formattable type
if [ -n "$CHANGED_FILE" ] && [ -f "$CHANGED_FILE" ]; then
  case "$CHANGED_FILE" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.css)
      bunx biome format --write "$CHANGED_FILE" 2>&1 || echo "Format failed for $CHANGED_FILE with exit code $?"
      ;;
    *)
      # Non-formattable file type (e.g., .md, .sh) — skip
      ;;
  esac
else
  # Fallback: format entire project if we couldn't extract the file path
  bun run format 2>&1 || echo "Format failed with exit code $?"
fi

exit 0
