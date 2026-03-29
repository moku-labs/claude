#!/usr/bin/env bash
# Detect Moku project type and state on session start.
# Creates/reads .planning/moku.md marker for fast detection by other hooks.
# Outputs context hints for Claude to understand the current project.

PROJECT_TYPE=""
PROJECT_NAME=""
CORE_VER=""

# --- Read from marker if it exists (fast path) ---
if [ -f .planning/moku.md ]; then
  PROJECT_TYPE=$(grep '^type:' .planning/moku.md 2>/dev/null | sed 's/type: //')
  PROJECT_NAME=$(grep '^name:' .planning/moku.md 2>/dev/null | sed 's/name: //')
  CORE_VER=$(grep '^core_version:' .planning/moku.md 2>/dev/null | sed 's/core_version: //')
fi

# --- Detect project type if not cached ---
if [ -z "$PROJECT_TYPE" ]; then
  # First-run detection — welcome new users with decision tree
  if [ -f package.json ] && ! [ -f .planning/STATE.md ] && ! [ -d src/plugins ]; then
    if grep -q '@moku-labs' package.json 2>/dev/null; then
      echo "Welcome to Moku! Choose your path:"
      echo ""
      echo "  Quick start:"
      echo "    /moku:init            — scaffold a new project (framework, app, or tools)"
      echo "    /moku:plan add plugin — add a plugin to an existing framework"
      echo ""
      echo "  Full workflow:"
      echo "    /moku:plan create framework \"description\" — plan a new framework (3-stage gated)"
      echo "    /moku:plan create app \"description\"       — plan a consumer app"
      echo "    /moku:plan migrate ~/path/to/project       — migrate existing code to Moku"
      echo ""
      echo "  Diagnostics:"
      echo "    /moku:check — run project diagnostics"
    fi
  fi

  # Check for Moku project markers
  if [ -f src/config.ts ] && grep -q 'createCoreConfig' src/config.ts 2>/dev/null; then
    PROJECT_TYPE="framework"
  elif [ -f package.json ] && grep -q 'createApp' src/index.ts 2>/dev/null; then
    PROJECT_TYPE="consumer"
  elif [ -f package.json ] && [ -f biome.json ] && [ -f vitest.config.ts ]; then
    if grep -q '@moku-labs' package.json 2>/dev/null; then
      PROJECT_TYPE="tools"
    fi
  fi

  # Extract project name from package.json
  if [ -z "$PROJECT_NAME" ] && [ -f package.json ]; then
    if command -v jq &>/dev/null; then
      PROJECT_NAME=$(jq -r '.name // empty' package.json 2>/dev/null)
    elif command -v python3 &>/dev/null; then
      PROJECT_NAME=$(python3 -c "import json; print(json.load(open('package.json')).get('name',''))" 2>/dev/null)
    fi
  fi

  # Extract @moku-labs/core version
  if [ -z "$CORE_VER" ] && [ -f package.json ]; then
    if command -v jq &>/dev/null; then
      CORE_VER=$(jq -r '.dependencies["@moku-labs/core"] // .devDependencies["@moku-labs/core"] // empty' package.json 2>/dev/null | sed 's/[\^~>=<]//g')
    elif command -v node &>/dev/null; then
      CORE_VER=$(node -e "const p=require('./package.json');const v=p.dependencies?.['@moku-labs/core']||p.devDependencies?.['@moku-labs/core']||'';console.log(v.replace(/[\^~>=<]/g,''))" 2>/dev/null)
    fi
  fi

  # Create marker file if we detected a project type and .planning/ exists
  if [ -n "$PROJECT_TYPE" ] && [ -d .planning ]; then
    cat > .planning/moku.md << MOKUEOF
# Moku Project

type: ${PROJECT_TYPE}
name: ${PROJECT_NAME}
core_version: ${CORE_VER}
created: $(date '+%Y-%m-%d')
MOKUEOF
  fi
fi

# --- Output context ---
case "$PROJECT_TYPE" in
  framework)
    echo "Moku Framework project detected (Layer 2)."
    PLUGIN_COUNT=$(find src/plugins -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PLUGIN_COUNT" -gt 0 ]; then
      echo "Plugins found: $PLUGIN_COUNT"
    fi
    ;;
  consumer)
    echo "Moku Consumer App detected (Layer 3)."
    ;;
  tools)
    echo "Moku Tools/Library project detected."
    ;;
esac

# Check planning state with quick-action suggestions
if [ -f .planning/STATE.md ]; then
  PHASE=$(grep '^## Phase:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Phase: //')
  NEXT=$(grep '^## Next Action:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Next Action: //')
  if [ -n "$PHASE" ]; then
    echo "Planning state: $PHASE"
    if [ -n "$NEXT" ]; then
      echo "Quick action: $NEXT"
    else
      echo "Resume with /moku:plan resume or /moku:build resume"
    fi
  fi
fi

# Suggest status line setup on first detection (if not already configured)
if [ -n "$PROJECT_TYPE" ]; then
  # Check if the user already has a status line configured
  STATUSLINE_CONFIGURED="false"
  if [ -f "$HOME/.claude/settings.json" ]; then
    if grep -q 'statusLine' "$HOME/.claude/settings.json" 2>/dev/null; then
      STATUSLINE_CONFIGURED="true"
    fi
  fi
  if [ "$STATUSLINE_CONFIGURED" = "false" ]; then
    echo ""
    echo "Tip: Set up the Moku status line for live project state in your terminal:"
    echo "  /statusline ${CLAUDE_PLUGIN_ROOT:-~/.claude/plugins/moku}/hooks/moku-statusline.sh"
  fi
fi

# Check for project-level memory
if [ -f .planning/memory.md ]; then
  MEMORY_LINES=$(wc -l < .planning/memory.md 2>/dev/null | tr -d ' ')
  echo "Project memory: $MEMORY_LINES lines in .planning/memory.md"
fi

# Check for specifications
SPEC_COUNT=$(find .planning/specs -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$SPEC_COUNT" -gt 0 ]; then
  echo "Specifications found: $SPEC_COUNT files in .planning/specs/"
fi

# Environment validation — warn early if required tools are missing or outdated
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
    printf '%b' "$WARNINGS"
  fi

  if [ -n "$CORE_VER" ]; then
    echo "@moku-labs/core: $CORE_VER"
  fi
fi

exit 0
