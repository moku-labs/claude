#!/usr/bin/env bash
# PreCompact hook: re-inject bounded planning state before context compaction.
# Caps output to ~150 lines max to avoid overwhelming the compacted context.

# STATE.md: inject headers + plugin table (first 80 lines)
if [ -f .planning/STATE.md ]; then
  echo '## Moku Planning State (re-injected before compaction)'
  head -80 .planning/STATE.md
  echo '... (full state in .planning/STATE.md)'
fi

# decisions.md: inject first 40 lines (key decisions summary)
if [ -f .planning/decisions.md ]; then
  echo ''
  echo '## Moku Decisions (re-injected before compaction)'
  head -40 .planning/decisions.md
fi

# research.md: inject only the summary, not full research
if [ -f .planning/research.md ]; then
  echo ''
  echo '## Moku Research Summary (full in .planning/research.md)'
  head -30 .planning/research.md
fi

exit 0
