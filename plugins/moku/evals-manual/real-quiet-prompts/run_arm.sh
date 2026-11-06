#!/bin/zsh
# One builder arm on the real case, spawned through the Agent tool so the plugin's SubagentStart and
# SubagentStop hooks (the builder check) run as they do in a real build. `claude -p --agent` would make the
# builder the main thread, and its stop would not be checked.
# usage: run_arm.sh <sonnet|high|deep> <rep> <memory_missing repo> <out dir> <node_modules clone>
# Writes <out>/real-<arm>-<rep>/ (the run), .json (the session result) and .err. Score with score.py.
set -u
set -o pipefail
ARM=$1; REP=$2; SRC=$3; OUT=$4; NM=$5
HERE=${0:A:h}; PLUGINS=${HERE:h:h:h}
R=$OUT/real-$ARM-$REP
bash $HERE/build.sh $SRC $R $NM >/dev/null || exit 2
BRIEF=$(sed "1,/^-->$/d" $HERE/prompt.md | sed "s|<root>|$R|g; s|<moku-game>|$PLUGINS/moku-game|g")
[ -n "$BRIEF" ] || { echo "empty brief" >&2; exit 3; }
case $ARM in
  sonnet) AGENT=moku:moku-builder; MODEL=', model "sonnet"' ;;
  high) AGENT=moku:moku-builder; MODEL='' ;;
  deep) AGENT=moku:moku-builder-deep; MODEL='' ;;
  *) echo "arm: sonnet, high or deep" >&2; exit 2 ;;
esac
PROMPT="Spawn exactly one agent with the Agent tool: subagent_type \"$AGENT\"$MODEL, and as its prompt the brief between the markers, word for word. Do nothing else yourself: no reads, no edits, no checks, no follow-up. When it returns, print its final report verbatim.
<<<BRIEF
$BRIEF
BRIEF>>>"
cd $R
START=$(date +%s)
PATH="$PLUGINS/moku/bin:$(echo "$PATH" | tr ':' '\n' | grep -v '/.claude/plugins/cache/' | paste -sd: -)" \
  claude -p "$PROMPT" --model sonnet --plugin-dir $PLUGINS/moku --plugin-dir $PLUGINS/moku-game --add-dir $PLUGINS/moku-game \
  --allowedTools "Agent Read Write Edit Bash Grep Glob" --permission-mode acceptEdits \
  --output-format json --max-budget-usd 6 > $R.json 2> $R.err
echo "exit=$? wall=$(( $(date +%s) - START ))" >> $R.err
# The builder's own check: $R/.planning/build/builder-checks/checks.jsonl
