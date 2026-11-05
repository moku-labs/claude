#!/usr/bin/env bash
# An initialized moku game-style consumer app on the rails with six plugins. A score travels through events:
# board emits board:cleared -> scoring turns it into score:changed (with a combo multiplier) -> hud shows it,
# leaderboard keeps the top five -> storage saves the leaderboard under "lb:v2" (debounced 500 ms), and sound
# plays a chime on a new best. Answering "how does a score get to the leaderboard" needs most of the files.
set -euo pipefail
git init -q -b main .
mkdir -p .planning src/plugins/{board,scoring,hud,leaderboard,storage,sound}
cat > package.json <<'JSON'
{ "name": "gems", "type": "module", "scripts": { "test": "node -e \"process.exit(0)\"" }, "dependencies": { "@moku-labs/core": "1.7.1" } }
JSON
printf 'type: consumer\nname: gems\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore

cat > src/config.ts <<'TS'
/**
 * @file Framework config: the events every plugin may emit or listen to.
 */
import { createCoreConfig } from "@moku-labs/core";

export type Events = {
  "board:cleared": { cells: number; chain: number };
  "score:changed": { total: number; gained: number; combo: number };
  "leaderboard:best": { total: number; rank: number };
};

export const coreConfig = createCoreConfig<{ seed: number }, Events>("gems", { config: { seed: 1 } });
export const { createPlugin, createCore } = coreConfig;
TS

cat > src/index.ts <<'TS'
/**
 * @file The app: wiring only.
 */
import { createCore } from "./config";
import { boardPlugin } from "./plugins/board";
import { hudPlugin } from "./plugins/hud";
import { leaderboardPlugin } from "./plugins/leaderboard";
import { scoringPlugin } from "./plugins/scoring";
import { soundPlugin } from "./plugins/sound";
import { storagePlugin } from "./plugins/storage";

export const { createApp } = createCore({ plugins: [storagePlugin, boardPlugin, scoringPlugin, leaderboardPlugin, hudPlugin, soundPlugin] });
export const app = createApp({});
TS

for p in board scoring hud leaderboard storage sound; do
  printf '/**\n * @file The %s plugin.\n */\nexport { %sPlugin } from "./plugin";\n' "$p" "$p" > "src/plugins/$p/index.ts"
done

cat > src/plugins/board/plugin.ts <<'TS'
import { createPlugin } from "../../config";

import { clearRuns, type Grid } from "./grid";

/** The board: a grid of gems. A swap clears runs of three or more, and every cascade step is one link of the chain. */
export const boardPlugin = createPlugin("board", {
  createState: () => ({ grid: [] as Grid, chain: 0 }),
  api: (ctx) => ({
    /**
     * Swap two cells and resolve every cascade it causes.
     *
     * @param a - first cell index
     * @param b - second cell index
     * @returns the number of cells cleared in total
     * @example
     * app.board.swap(3, 4); // 6
     */
    swap(a: number, b: number): number {
      const grid = [...ctx.state.grid];
      [grid[a], grid[b]] = [grid[b], grid[a]];
      let total = 0;
      for (let chain = 1; ; chain++) {
        const cleared = clearRuns(grid);
        if (cleared === 0) break;
        total += cleared;
        ctx.emit("board:cleared", { cells: cleared, chain });
      }
      ctx.state.grid = grid;
      return total;
    },
  }),
});
TS

cat > src/plugins/board/grid.ts <<'TS'
/** A row-major grid of gem colours; -1 is an empty cell. */
export type Grid = number[];

const WIDTH = 8;

/**
 * Clear every horizontal or vertical run of three or more equal gems and let the column fall.
 *
 * @param grid - the grid, changed in place
 * @returns how many cells were cleared
 * @example
 * clearRuns([1, 1, 1, 2]); // 3
 */
export function clearRuns(grid: Grid): number {
  const marked = new Set<number>();
  for (let i = 0; i < grid.length; i++) {
    const colour = grid[i];
    if (colour < 0) continue;
    if (i % WIDTH <= WIDTH - 3 && grid[i + 1] === colour && grid[i + 2] === colour) [i, i + 1, i + 2].forEach((c) => marked.add(c));
    if (grid[i + WIDTH] === colour && grid[i + 2 * WIDTH] === colour) [i, i + WIDTH, i + 2 * WIDTH].forEach((c) => marked.add(c));
  }
  for (const cell of marked) grid[cell] = -1;
  return marked.size;
}
TS

cat > src/plugins/scoring/plugin.ts <<'TS'
import { createPlugin } from "../../config";

import { pointsFor } from "./rules";

/** Scoring: turns cleared cells into points. The combo is the cascade chain; it resets when a swap clears nothing. */
export const scoringPlugin = createPlugin("scoring", {
  depends: ["board"],
  createState: () => ({ total: 0 }),
  hooks: (ctx) => ({
    "board:cleared": ({ cells, chain }) => {
      const gained = pointsFor(cells, chain);
      ctx.state.total += gained;
      ctx.emit("score:changed", { total: ctx.state.total, gained, combo: chain });
    },
  }),
  api: (ctx) => ({
    /**
     * The running total.
     *
     * @returns points so far
     * @example
     * app.scoring.total(); // 120
     */
    total: () => ctx.state.total,
  }),
});
TS

cat > src/plugins/scoring/rules.ts <<'TS'
/** Ten points a cell. */
export const POINTS_PER_CELL = 10;

/** The combo multiplier stops growing at x4. */
export const MAX_COMBO = 4;

/**
 * Points for one cascade step: cells x 10 x min(chain, 4).
 *
 * @param cells - cells cleared in this step
 * @param chain - which step of the cascade this is, from 1
 * @returns points gained
 * @example
 * pointsFor(3, 2); // 60
 */
export function pointsFor(cells: number, chain: number): number {
  return cells * POINTS_PER_CELL * Math.min(chain, MAX_COMBO);
}
TS

cat > src/plugins/hud/plugin.ts <<'TS'
import { createPlugin } from "../../config";

/** The HUD: the score line and a "x3 combo!" flash. It only listens; it never changes the score. */
export const hudPlugin = createPlugin("hud", {
  createState: () => ({ line: "Score: 0", flash: "" }),
  hooks: (ctx) => ({
    "score:changed": ({ total, combo }) => {
      ctx.state.line = `Score: ${total}`;
      ctx.state.flash = combo > 1 ? `x${combo} combo!` : "";
    },
  }),
  api: (ctx) => ({
    /**
     * What the HUD shows now.
     *
     * @returns the score line and the flash text
     * @example
     * app.hud.view(); // { line: "Score: 60", flash: "x2 combo!" }
     */
    view: () => ({ line: ctx.state.line, flash: ctx.state.flash }),
  }),
});
TS

cat > src/plugins/leaderboard/plugin.ts <<'TS'
import { createPlugin } from "../../config";

import { insertScore } from "./table";

/**
 * The leaderboard: the best five totals of this device. It takes the total from score:changed, keeps the table
 * sorted, asks storage to save it, and emits leaderboard:best when the total takes first place.
 */
export const leaderboardPlugin = createPlugin("leaderboard", {
  depends: ["scoring", "storage"],
  createState: () => ({ rows: [] as number[] }),
  onInit: (ctx) => {
    ctx.state.rows = ctx.require("storage").load<number[]>("lb:v2") ?? [];
  },
  hooks: (ctx) => ({
    "score:changed": ({ total }) => {
      const { rows, rank } = insertScore(ctx.state.rows, total);
      ctx.state.rows = rows;
      ctx.require("storage").save("lb:v2", rows);
      if (rank === 1) ctx.emit("leaderboard:best", { total, rank });
    },
  }),
  api: (ctx) => ({
    /**
     * The table, best first.
     *
     * @returns at most five totals
     * @example
     * app.leaderboard.rows(); // [340, 120]
     */
    rows: () => [...ctx.state.rows],
  }),
});
TS

cat > src/plugins/leaderboard/table.ts <<'TS'
/** The table keeps this many rows. */
export const ROWS = 5;

/**
 * Put a total into the sorted table, replacing the run's previous entry so one game is one row.
 *
 * @param rows - the table, best first
 * @param total - the run's total so far
 * @returns the new table and the total's rank (0 when it did not make the table)
 * @example
 * insertScore([300], 340); // { rows: [340, 300], rank: 1 }
 */
export function insertScore(rows: number[], total: number): { rows: number[]; rank: number } {
  const next = [...rows, total].sort((a, b) => b - a).slice(0, ROWS);
  return { rows: next, rank: next.indexOf(total) + 1 };
}
TS

cat > src/plugins/storage/plugin.ts <<'TS'
import { createPlugin } from "../../config";

/** Saves are debounced: many score changes in a cascade write once. */
export const SAVE_DEBOUNCE_MS = 500;

/** Storage: JSON in localStorage, keys versioned by the caller ("lb:v2"). A save is debounced per key. */
export const storagePlugin = createPlugin("storage", {
  createState: () => ({ timers: new Map<string, ReturnType<typeof setTimeout>>() }),
  api: (ctx) => ({
    /**
     * Read a value saved earlier.
     *
     * @param key - the versioned key
     * @returns the value, or undefined when nothing was saved
     * @example
     * app.storage.load<number[]>("lb:v2"); // [340, 120]
     */
    load<T>(key: string): T | undefined {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    },
    /**
     * Save a value after 500 ms without another save of the same key.
     *
     * @param key - the versioned key
     * @param value - any JSON value
     * @example
     * app.storage.save("lb:v2", [340, 120]);
     */
    save(key: string, value: unknown): void {
      clearTimeout(ctx.state.timers.get(key));
      ctx.state.timers.set(key, setTimeout(() => globalThis.localStorage?.setItem(key, JSON.stringify(value)), SAVE_DEBOUNCE_MS));
    },
  }),
});
TS

cat > src/plugins/sound/plugin.ts <<'TS'
import { createPlugin } from "../../config";

/** Sound: a chime when the leaderboard says the run took first place. */
export const soundPlugin = createPlugin("sound", {
  createState: () => ({ played: [] as string[] }),
  hooks: (ctx) => ({
    "leaderboard:best": () => {
      ctx.state.played.push("chime");
    },
  }),
  api: (ctx) => ({
    /**
     * Sounds played so far, for tests.
     *
     * @returns sound names in order
     * @example
     * app.sound.played(); // ["chime"]
     */
    played: () => [...ctx.state.played],
  }),
});
TS

# Plugins off the score path, sized like a real project: reading the whole tree costs the main thread ~25k tokens
for p in input timer theme settings tutorial levels; do
  mkdir -p "src/plugins/$p"
  printf '/**\n * @file The %s plugin.\n */\nexport { %sPlugin } from "./plugin";\n' "$p" "$p" > "src/plugins/$p/index.ts"
  {
    printf 'import { createPlugin } from "../../config";\n\nimport { TABLE } from "./data";\n\n'
    printf '/** The %s plugin: reads its table and never touches the score. */\n' "$p"
    printf 'export const %sPlugin = createPlugin("%s", {\n  createState: () => ({ index: 0 }),\n  api: (ctx) => ({\n' "$p" "$p"
    printf '    /**\n     * The current entry of the table.\n     *\n     * @returns the entry\n     * @example\n     * app.%s.current();\n     */\n' "$p"
    printf '    current: () => TABLE[ctx.state.index %% TABLE.length],\n    /**\n     * Move to the next entry.\n     *\n     * @example\n     * app.%s.next();\n     */\n    next: () => {\n      ctx.state.index += 1;\n    },\n  }),\n});\n' "$p"
  } > "src/plugins/$p/plugin.ts"
  {
    printf '/** Entries of the %s table, generated from the design sheet. */\nexport const TABLE = [\n' "$p"
    for i in $(seq 1 120); do printf '  { id: "%s-%03d", weight: %d, label: "%s entry %d", tags: ["a%d", "b%d"], enabled: %s },\n' "$p" "$i" $((i * 7 % 13)) "$p" "$i" $((i % 5)) $((i % 3)) $([ $((i % 4)) = 0 ] && echo false || echo true); done
    printf '] as const;\n'
  } > "src/plugins/$p/data.ts"
done

git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
