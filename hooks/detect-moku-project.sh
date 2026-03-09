#!/usr/bin/env bash
# Detect Moku project type and state on session start.
# Outputs context hints for Claude to understand the current project.

# First-run detection — welcome new users
if [ -f package.json ] && ! [ -f .planning/STATE.md ] && ! [ -d src/plugins ]; then
  if grep -q '@moku-labs' package.json 2>/dev/null; then
    echo "Welcome to Moku! Get started with:"
    echo "  /moku:init   — scaffold a new framework project"
    echo "  /moku:plan create framework — plan a new framework"
    echo "  /moku:check  — run project diagnostics"
  fi
fi

# Check for Moku project markers
if [ -f src/config.ts ] && grep -q 'createCoreConfig' src/config.ts 2>/dev/null; then
  echo "Moku Framework project detected (Layer 2)."

  # Count plugins
  PLUGIN_COUNT=$(find src/plugins -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PLUGIN_COUNT" -gt 0 ]; then
    echo "Plugins found: $PLUGIN_COUNT"
  fi
elif [ -f package.json ] && grep -q 'createApp' src/index.ts 2>/dev/null; then
  echo "Moku Consumer App detected (Layer 3)."
elif [ -f package.json ] && [ -f biome.json ] && [ -f vitest.config.ts ]; then
  echo "Moku Tools/Library project detected."
fi

# Check planning state
if [ -f .planning/STATE.md ]; then
  PHASE=$(grep '^## Phase:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Phase: //')
  if [ -n "$PHASE" ]; then
    echo "Planning state: $PHASE"
    echo "Resume with /moku:build resume or /moku:plan to continue."
  fi
fi

# Check for specifications
SPEC_COUNT=$(find .planning/specs -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$SPEC_COUNT" -gt 0 ]; then
  echo "Specifications found: $SPEC_COUNT files in .planning/specs/"
fi

# C9: Environment validation — warn early if required tools are missing or outdated
if [ -f package.json ] && grep -q '@moku-labs' package.json 2>/dev/null; then
  WARNINGS=""

  # Check Bun
  if command -v bun &>/dev/null; then
    BUN_VER=$(bun --version 2>/dev/null)
    BUN_MAJOR=$(echo "$BUN_VER" | cut -d. -f1)
    BUN_MINOR=$(echo "$BUN_VER" | cut -d. -f2)
    BUN_PATCH=$(echo "$BUN_VER" | cut -d. -f3)
    if [ "${BUN_MAJOR:-0}" -lt 1 ] || { [ "${BUN_MAJOR:-0}" -eq 1 ] && [ "${BUN_MINOR:-0}" -lt 3 ]; } || { [ "${BUN_MAJOR:-0}" -eq 1 ] && [ "${BUN_MINOR:-0}" -eq 3 ] && [ "${BUN_PATCH:-0}" -lt 8 ]; }; then
      WARNINGS="${WARNINGS}  - Bun $BUN_VER found, but >= 1.3.8 required\n"
    fi
  else
    WARNINGS="${WARNINGS}  - Bun not found (required)\n"
  fi

  # Check Node
  if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
      WARNINGS="${WARNINGS}  - Node $(node --version) found, but >= 22 required\n"
    fi
  else
    WARNINGS="${WARNINGS}  - Node not found (required)\n"
  fi

  # Check TypeScript compiler
  if ! command -v tsc &>/dev/null && ! [ -f node_modules/.bin/tsc ]; then
    WARNINGS="${WARNINGS}  - tsc not found (install typescript)\n"
  fi

  if [ -n "$WARNINGS" ]; then
    echo "Environment warnings:"
    printf "$WARNINGS"
  fi

  # C8: Version compatibility — check @moku-labs/core version
  if command -v jq &>/dev/null; then
    CORE_VER=$(jq -r '.dependencies["@moku-labs/core"] // .devDependencies["@moku-labs/core"] // empty' package.json 2>/dev/null | sed 's/[\^~>=<]//g')
  elif command -v node &>/dev/null; then
    CORE_VER=$(node -e "const p=require('./package.json');const v=p.dependencies?.['@moku-labs/core']||p.devDependencies?.['@moku-labs/core']||'';console.log(v.replace(/[\^~>=<]/g,''))" 2>/dev/null)
  fi
  if [ -n "$CORE_VER" ]; then
    echo "@moku-labs/core: $CORE_VER"
  fi
fi

exit 0
