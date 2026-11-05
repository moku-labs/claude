#!/usr/bin/env bash
# A real delta fix, cut down: a moku game project paused at the build station with two
# per-frame allocations the architecture validator flagged (from a real memory_missing run).
set -euo pipefail
git init -q -b main .
P=src/plugins/timeline
mkdir -p "$P/__tests__/unit" .planning/specs
printf '{ "name": "promo", "type": "module", "scripts": { "test": "bun test" }, "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: consumer\nname: promo\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-10-22-promo", "title": "Promo timeline", "type": "feature", "size": "S", "status": "open", "station": "build", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
cat > "$P/rules.ts" <<'TS'
/** The length of each clock step, in milliseconds. */
export const STEPS: readonly number[] = Object.freeze([400, 250, 250, 600, 300, 900]);

/** Camera moves in the order the promo plays them. */
export const MOVES: readonly string[] = Object.freeze(["wide", "pan", "close", "hold"]);

/**
 * Milliseconds from the start of step `start` to the start of step `now`.
 *
 * @param start - the first step, counted from 0
 * @param now - the step reached
 * @returns the summed length of the steps in between; 0 when `now` is not after `start`
 */
export function sinceStart(start: number, now: number): number {
  return STEPS.slice(start, now).reduce((sum, step) => sum + step, 0);
}

/**
 * The camera move `back` moves before the last one.
 *
 * @param back - how many moves back from the end, 0 for the last
 * @returns the move, or "hold" past the first
 */
export function cameraOf(back: number): string {
  return MOVES.toReversed()[back] ?? "hold";
}
TS
cat > "$P/__tests__/unit/rules.test.ts" <<'TS'
import { describe, expect, it } from "bun:test";
import { cameraOf, sinceStart } from "../../rules";

describe("sinceStart", () => {
  it("sums the steps between start and now", () => expect(sinceStart(1, 4)).toBe(1100));
  it("is 0 when now is not after start", () => expect(sinceStart(3, 3)).toBe(0));
});

describe("cameraOf", () => {
  it("counts back from the last move", () => expect(cameraOf(0)).toBe("hold"));
  it("holds past the first", () => expect(cameraOf(9)).toBe("hold"));
});
TS
cat > .planning/specs/01-timeline.md <<'MD'
# timeline

Pure rules of the promo clock. Called about 60 times a frame: no allocation per call.
MD
git add -A && git commit -qm "timeline plugin"
