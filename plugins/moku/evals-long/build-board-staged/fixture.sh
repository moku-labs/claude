#!/usr/bin/env bash
# A Complex plugin to build from a spec (a merge board, as in the real memory_missing game).
# Plain TypeScript run by `bun test`, no install. The build goes to moku-builder-deep.
set -euo pipefail
git init -q -b main . 2>/dev/null || true   # git can be blocked in the eval sandbox
mkdir -p src/plugins/board .planning/specs
printf '{ "name": "merge", "type": "module", "scripts": { "test": "bun test" }, "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: consumer\nname: merge\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-11-05-board", "title": "Merge board rules", "type": "feature", "size": "M", "status": "open", "station": "build", "done": ["intake", "plan"], "skipped": ["design"], "note": "design skipped: pure rules, no screens", "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
cat > .planning/specs/01-board.md <<'MD'
# board

The merge board of a merge-2 puzzle game: pure rules, no rendering. Tier: Complex.
All functions are pure: they return a new state and never mutate their input.
Times are milliseconds since epoch passed in by the caller; randomness only through the `Rng` passed in.

## Types
- `Item = { kind: string; tier: number }` — tier counts from 1.
- `Cell = Item | null`; `Board = { width: number; height: number; cells: Cell[] }`, row-major, index = y * width + x.
- `Catalog = Record<string, { maxTier: number; cost: number[] }>` — `cost[t - 1]` is the star value of tier t.
- `Rng = () => number` in [0, 1). `mulberry32(seed)` is exported from `rng.ts` with the standard algorithm.

## grid.ts
- `createBoard(width, height)`: all cells empty. Throws RangeError unless both are integers in 1..12.
- `at(board, x, y)` / `put(board, x, y, cell)`: out-of-range coordinates throw RangeError.
- `emptyCells(board)`: indices of empty cells in row-major order.
- `nearestEmpty(board, x, y)`: the empty cell with the smallest Manhattan distance; ties go to the lower index; null when the board is full.

## merge.ts
- `drop(board, catalog, from, to)` moves the item at index `from` onto index `to`:
  - `to` empty: the item moves.
  - same kind and tier, below `maxTier`: one item of tier + 1 lands on `to`, `from` becomes empty; returns `{ board, merged: true }`.
  - otherwise (different item, or both at `maxTier`): the two swap; `merged: false`.
  - `from === to` or an empty `from` throws RangeError.

## generators.ts
- A generator is an item whose catalog entry has `produces: { kind: string; energy: number; weights: number[] }`; `weights[t - 1]` is the weight of producing tier t.
- `tap(board, catalog, index, energy, rng)`:
  - not a generator: throws TypeError.
  - `energy.value < produces.energy`: returns `{ board, energy, produced: null, reason: "no-energy" }` unchanged.
  - board full: `{ ..., produced: null, reason: "board-full" }`, energy not spent.
  - otherwise picks a tier by weight with one `rng()` call (cumulative weights, first bucket whose cumulative share exceeds the draw), puts it on `nearestEmpty` of the generator, spends the energy, returns `produced` (the index).

## energy.ts
- `Energy = { value: number; max: number; at: number }` — `at` is the time of the last update.
- One point every 120 000 ms. `regen(energy, now)`: adds whole points elapsed since `at`, capped at `max`; `at` advances only by the whole intervals used (the remainder carries over). At `max`, `at` becomes `now`.
- `spend(energy, amount, now)`: regen first, then subtract; throws RangeError when not enough.
- `now < at` throws RangeError (clock went back).

## orders.ts
- `Order = { id: string; needs: Item[] }`.
- `canFulfil(board, order)`: every needed item is on the board (each board item counts once).
- `fulfil(board, catalog, order)`: removes one matching item per need, choosing the lowest index first; returns `{ board, stars }` with stars = sum of `cost[tier - 1]` of the needs. Throws Error("order-not-ready") when it cannot.

## save.ts
- `save(state)` → string: `{"v":2,"board":…,"energy":…}`.
- `load(text)`: accepts v2; migrates v1 (`{"v":1,"cells":[…],"w":n,"h":n,"energy":n}` with energy as a plain number → `{ value, max: 100, at: 0 }`); any other version throws Error("save-version").

## undo.ts
- `history()` returns an empty stack; `record(stack, board)` pushes, keeping at most 20 (the oldest drops); `undo(stack)` → `{ stack, board }` with the last board, or null when empty.

## Verification
Each rule above has at least one test that fails if the rule is broken: boundaries (0, 1, 12, 13 sizes; maxTier; exactly 120 000 ms; the 21st record), the tie in nearestEmpty, the weighted pick with a fixed seed, the v1 migration, and every throw.
MD
printf '/** The board plugin: merge-board rules. */\nexport {};\n' > src/plugins/board/index.ts
{ git add -A && git -c user.name=eval -c user.email=eval@local commit -qm "board plugin skeleton"; } 2>/dev/null || true
