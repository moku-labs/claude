#!/bin/zsh
# usage: run_f2.sh <plan|code> <high|medium> <rep> <out dir> <plugin copy>
# Runs one validator as the session agent on a fresh fixture; writes report + json metrics.
set -u
KIND=$1; EFFORT=$2; REP=$3; OUT=$4; PLUG=$5
HERE=${0:A:h}; W=$OUT/$KIND-$EFFORT-$REP
mkdir -p $W && cd $W && bash $HERE/$KIND-fixture.sh
if [ $KIND = plan ]; then AGENT=moku:moku-plan-checker; ASK="Check the plan in .planning/ (specs in .planning/specs/, requirements in .planning/context-notes.md) before it reaches the user."; else AGENT=moku:moku-architecture-validator; ASK="Validate the cross-plugin architecture of this framework (src/)."; fi
PATH="$PLUG/bin:$(echo "$PATH" | tr ':' '\n' | grep -v '/.claude/plugins/cache/' | paste -sd: -)" \
  claude -p "$ASK Report every finding." --agent $AGENT --effort $EFFORT --plugin-dir $PLUG --add-dir $PLUG \
  --output-format json --max-budget-usd 4 > $OUT/$KIND-$EFFORT-$REP.json 2> $OUT/$KIND-$EFFORT-$REP.err
echo "exit=$?" >> $OUT/$KIND-$EFFORT-$REP.err
