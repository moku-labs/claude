#!/usr/bin/env bash
# Real case from memory_missing commit 2a74eacb (2026-10-29, S fix): the board's prompts keep quiet
# during the second chain's lesson. Builds the tree as it was just before the fix. Reads the
# source repo only (git archive); node_modules links to a clone of the source install.
# usage: build.sh <memory_missing repo> <out dir (new)> <node_modules clone>  (never link the live repo: vitest writes its cache there)
set -euo pipefail
SRC=$1; OUT=$2; NM=$3
mkdir "$OUT"
git -C "$SRC" archive 2a74eacb^ | tar -x -C "$OUT"
ln -s "$NM" "$OUT/node_modules"
cd "$OUT"
mkdir -p .planning/changes/2026-10-29-second-chain-quiet
printf '# Moku Project\n\ntype: game\nname: a-memory-missing\ncore_version: 1.7.6\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-10-29-second-chain-quiet", "title": "The board prompts keep quiet during the second-chain lesson", "type": "fix", "size": "S", "status": "open", "station": "build", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
cat > .planning/changes/2026-10-29-second-chain-quiet/intake.md <<'MD'
# Fix: the board's prompts keep quiet during the second-chain lesson (S)

Seen in the editor (playtest 2026-10-29): during the one-time lesson of the second chain
(`player.lessons.secondChain`), the board's prompt hand kept tapping the generator under the
lesson's veil, on the lesson's `tap` step and on its `look` step.

Expected: while that lesson guides the player (its `tap` and `look` steps) the board's prompt queue
keeps quiet, the same way it does for the welcome gift's lesson and the shop's lesson. Before the
lesson (`waiting`) and after it (`done`) the prompts behave as today.
MD
git init -q -b main .
git add -A >/dev/null
git -c user.name=eval -c user.email=eval@example.test commit -q -m "before the fix (2a74eacb^)"
