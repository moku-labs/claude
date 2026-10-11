#!/usr/bin/env bash
# A change that follows the design "board" sits inside the build station. The plugin is written, its
# spec is met and its tests are green. The design check never ran: there is no
# .planning/design/board/check/design-check.md. The rails must hold the build station open.
set -euo pipefail
git init -q -b main .
P=src/plugins/board
mkdir -p "$P/__tests__/unit" .planning/design/board .planning/specs
printf '{ "name": "tiles", "type": "module", "scripts": { "test": "bun test" }, "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: consumer\nname: tiles\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-10-11-board", "title": "The board", "type": "feature", "size": "M", "status": "open", "station": "build", "done": ["intake", "design", "plan"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false, "design": "board" }], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
cat > .planning/design/board/design-context.md <<'MD'
# Board — Design Context

**Measurement reference**
| Field | Value |
|---|---|
| Prototype | `.planning/design/board/index.html` and `styles.scss` |
| Prototype frame | 390×693 CSS px |
| Target units | CSS px |
| Conversion | target = prototype px × 1 |
MD
printf '<!doctype html><link rel="stylesheet" href="styles.css"><div class="tray"></div>\n' > .planning/design/board/index.html
printf '.tray { position: absolute; left: 41px; top: 194px; width: 308px; height: 308px; border-radius: 26px; }\n' > .planning/design/board/styles.scss
cat > .planning/specs/01-board.md <<'MD'
# board

## Design Reference
- Prototype: `.planning/design/board/index.html` and `styles.scss`
- Units: CSS px = prototype px × 1

## Verification
- Three marks of one player in a row, a column or a diagonal win.
- A full board with no line is a draw.
- The design check passes for the board's inventory rows.
MD
cat > "$P/rules.ts" <<'TS'
/** A cell of the board. */
export type Mark = "x" | "o" | undefined;

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]] as const;

/**
 * Who has won, if anyone.
 *
 * @param cells - the nine cells, left to right, top to bottom
 * @returns the winner, "draw" on a full board with no line, or undefined while the round goes on
 */
export function outcome(cells: Mark[]): "x" | "o" | "draw" | undefined {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }

  return cells.every(Boolean) ? "draw" : undefined;
}
TS
cat > "$P/index.ts" <<'TS'
export { outcome } from "./rules";
export type { Mark } from "./rules";
TS
cat > "$P/__tests__/unit/rules.test.ts" <<'TS'
import { describe, expect, it } from "bun:test";

import { outcome } from "../../rules";

const _ = undefined;

describe("outcome", () => {
  it("gives the round to three in the right column", () => {
    expect(outcome([_, _, "o", "x", _, "o", "x", _, "o"])).toBe("o");
  });

  it("gives the round to three on a diagonal", () => {
    expect(outcome(["x", "o", _, _, "x", "o", _, _, "x"])).toBe("x");
  });

  it("calls a full board with no line a draw", () => {
    expect(outcome(["x", "x", "o", "o", "x", "x", "x", "o", "o"])).toBe("draw");
  });

  it("is undecided while a cell is empty and no line stands", () => {
    expect(outcome(["x", "o", _, _, _, _, _, _, _])).toBeUndefined();
  });
});
TS
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
