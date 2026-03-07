#!/usr/bin/env bash
# Detect Moku project type and state on session start.
# Outputs context hints for Claude to understand the current project.

# First-run detection — welcome new users
if [ -f package.json ] && ! [ -f .planning/STATE.md ] && ! [ -d src/plugins ]; then
  if grep -q 'moku' package.json 2>/dev/null; then
    echo "Welcome to Moku! Get started with:"
    echo "  /moku:init   — scaffold a new framework project"
    echo "  /moku:plan   — plan plugins from specifications"
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
SPEC_COUNT=$(find specifications -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$SPEC_COUNT" -gt 0 ]; then
  echo "Specifications found: $SPEC_COUNT files in specifications/"
fi

exit 0
