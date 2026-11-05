// Hidden acceptance tests of the spec, run after the eval on each kept run (not seen by the agent).
import { describe, expect, it } from "bun:test";
import { at, createBoard, emptyCells, nearestEmpty, put } from "./src/plugins/board/grid";
import { drop } from "./src/plugins/board/merge";
import { tap } from "./src/plugins/board/generators";
import { regen, spend } from "./src/plugins/board/energy";
import { canFulfil, fulfil } from "./src/plugins/board/orders";
import { load, save } from "./src/plugins/board/save";
import { history, record, undo } from "./src/plugins/board/undo";
import { mulberry32 } from "./src/plugins/board/rng";

const catalog: any = {
  flower: { maxTier: 3, cost: [1, 3, 9] },
  pot: { maxTier: 2, cost: [2, 5], produces: { kind: "flower", energy: 2, weights: [3, 1] } },
};
const item = (kind: string, tier: number) => ({ kind, tier });
const withCells = (w: number, h: number, cells: any[]) => ({ ...createBoard(w, h), cells });

describe("grid", () => {
  it("accepts sizes 1 and 12", () => { expect(createBoard(1, 1).cells.length).toBe(1); expect(createBoard(12, 12).cells.length).toBe(144); });
  it("refuses 0, 13 and fractions", () => {
    expect(() => createBoard(0, 1)).toThrow(RangeError); expect(() => createBoard(13, 1)).toThrow(RangeError); expect(() => createBoard(1.5, 2)).toThrow(RangeError);
  });
  it("is row-major and pure", () => {
    const b = createBoard(3, 2); const b2 = put(b, 2, 1, item("flower", 1));
    expect(b2.cells[5]).toEqual(item("flower", 1)); expect(b.cells[5]).toBeNull(); expect(at(b2, 2, 1)).toEqual(item("flower", 1));
  });
  it("throws out of range", () => { const b = createBoard(2, 2); expect(() => at(b, 2, 0)).toThrow(RangeError); expect(() => put(b, -1, 0, null)).toThrow(RangeError); });
  it("lists empty cells in order", () => { expect(emptyCells(withCells(2, 2, [null, item("flower", 1), null, null]))).toEqual([0, 2, 3]); });
  it("nearestEmpty breaks a tie by the lower index", () => {
    const cells = Array(9).fill(null); cells[4] = item("pot", 1);
    const b = withCells(3, 3, cells); const n = nearestEmpty(b, 1, 1);
    expect(n === 1 || (typeof n === "object" && n !== null)).toBe(true);
    expect(typeof n === "number" ? n : (n as any).index ?? (n as any).y * 3 + (n as any).x).toBe(1);
  });
  it("nearestEmpty is null on a full board", () => { expect(nearestEmpty(withCells(1, 1, [item("flower", 1)]), 0, 0)).toBeNull(); });
});

describe("merge", () => {
  it("moves onto an empty cell", () => { const r = drop(withCells(2, 1, [item("flower", 1), null]), catalog, 0, 1); expect(r.board.cells).toEqual([null, item("flower", 1)]); expect(r.merged).toBe(false); });
  it("merges two equal items into the next tier", () => {
    const b = withCells(2, 1, [item("flower", 1), item("flower", 1)]); const r = drop(b, catalog, 0, 1);
    expect(r.merged).toBe(true); expect(r.board.cells).toEqual([null, item("flower", 2)]); expect(b.cells[0]).toEqual(item("flower", 1));
  });
  it("swaps at maxTier", () => { const r = drop(withCells(2, 1, [item("flower", 3), item("flower", 3)]), catalog, 0, 1); expect(r.merged).toBe(false); expect(r.board.cells).toEqual([item("flower", 3), item("flower", 3)]); });
  it("swaps different items", () => { const r = drop(withCells(2, 1, [item("flower", 1), item("flower", 2)]), catalog, 0, 1); expect(r.board.cells).toEqual([item("flower", 2), item("flower", 1)]); });
  it("refuses from === to and an empty from", () => {
    const b = withCells(2, 1, [item("flower", 1), null]); expect(() => drop(b, catalog, 0, 0)).toThrow(RangeError); expect(() => drop(b, catalog, 1, 0)).toThrow(RangeError);
  });
});

describe("rng", () => {
  it("is mulberry32", () => {
    let a = 42; const ref = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r = mulberry32(42); for (let i = 0; i < 5; i++) expect(r()).toBe(ref());
  });
});

describe("generators", () => {
  const energy = { value: 10, max: 100, at: 0 };
  const board = () => { const c = Array(4).fill(null); c[0] = item("pot", 1); return withCells(2, 2, c); };
  it("throws on an item that is not a generator", () => { expect(() => tap(withCells(1, 1, [item("flower", 1)]), catalog, 0, energy, () => 0)).toThrow(TypeError); });
  it("picks by cumulative weight: 0.74 is tier 1, 0.75 tier 2", () => {
    expect(tap(board(), catalog, 0, energy, () => 0.74).board.cells[1]).toEqual(item("flower", 1));
    expect(tap(board(), catalog, 0, energy, () => 0.75).board.cells[1]).toEqual(item("flower", 2));
  });
  it("spends the energy and reports the index", () => { const r = tap(board(), catalog, 0, energy, () => 0); expect(r.energy.value).toBe(8); expect(r.produced).toBe(1); });
  it("without energy changes nothing", () => { const r = tap(board(), catalog, 0, { ...energy, value: 1 }, () => 0); expect(r.produced).toBeNull(); expect(r.reason).toBe("no-energy"); expect(r.energy.value).toBe(1); });
  it("on a full board spends nothing", () => {
    const r = tap(withCells(1, 1, [item("pot", 1)]), catalog, 0, energy, () => 0); expect(r.reason).toBe("board-full"); expect(r.energy.value).toBe(10);
  });
});

describe("energy", () => {
  it("adds whole points and carries the remainder", () => { const e = regen({ value: 5, max: 100, at: 0 }, 250_000); expect(e.value).toBe(7); expect(e.at).toBe(240_000); });
  it("exactly 120 000 ms is one point", () => { expect(regen({ value: 5, max: 100, at: 0 }, 120_000).value).toBe(6); expect(regen({ value: 5, max: 100, at: 0 }, 119_999).value).toBe(5); });
  it("caps at max and moves at to now", () => { const e = regen({ value: 99, max: 100, at: 0 }, 360_000); expect(e.value).toBe(100); expect(e.at).toBe(360_000); });
  it("refuses a clock that went back", () => { expect(() => regen({ value: 1, max: 100, at: 10 }, 5)).toThrow(RangeError); });
  it("spend regens first, then refuses too much", () => {
    expect(spend({ value: 0, max: 100, at: 0 }, 1, 120_000).value).toBe(0);
    expect(() => spend({ value: 0, max: 100, at: 0 }, 2, 120_000)).toThrow(RangeError);
  });
});

describe("orders", () => {
  const b = withCells(3, 1, [item("flower", 2), item("flower", 2), item("flower", 1)]);
  it("counts each board item once", () => {
    expect(canFulfil(b, { id: "a", needs: [item("flower", 2), item("flower", 2)] })).toBe(true);
    expect(canFulfil(b, { id: "b", needs: [item("flower", 1), item("flower", 1)] })).toBe(false);
  });
  it("removes the lowest index first and pays the stars", () => {
    const r = fulfil(b, catalog, { id: "a", needs: [item("flower", 2), item("flower", 1)] });
    expect(r.board.cells).toEqual([null, item("flower", 2), null]); expect(r.stars).toBe(4);
  });
  it("throws order-not-ready", () => { expect(() => fulfil(b, catalog, { id: "c", needs: [item("pot", 1)] })).toThrow("order-not-ready"); });
});

describe("save", () => {
  it("round-trips v2", () => {
    const state = { board: withCells(2, 1, [item("flower", 1), null]), energy: { value: 3, max: 100, at: 7 } };
    const text = save(state as any); expect(JSON.parse(text).v).toBe(2); expect(load(text)).toEqual(state as any);
  });
  it("migrates v1", () => {
    const s: any = load(JSON.stringify({ v: 1, cells: [null, item("flower", 1)], w: 2, h: 1, energy: 7 }));
    expect(s.board.width).toBe(2); expect(s.board.cells[1]).toEqual(item("flower", 1)); expect(s.energy).toEqual({ value: 7, max: 100, at: 0 });
  });
  it("refuses another version", () => { expect(() => load('{"v":3}')).toThrow("save-version"); });
});

describe("undo", () => {
  it("returns the last board, keeps 20, then null", () => {
    let s = history(); for (let i = 0; i < 21; i++) s = record(s, createBoard(1, i % 12 + 1));
    let r = undo(s)!; expect(r.board.height).toBe(9); // 21st record: i = 20 → 20 % 12 + 1
    let n = 1; while ((r = undo(r.stack)!)) n++;
    expect(n).toBe(20);
  });
  it("is null when empty", () => { expect(undo(history())).toBeNull(); });
});

// The edges of the spec that a plausible implementation gets wrong; the tests above pass for most builds.
const indexOf = (n: any, w: number) => (typeof n === "number" ? n : n?.index ?? n.y * w + n.x);

describe("edges", () => {
  it("regen at max: the remainder does not carry, at becomes now", () => {
    const e = regen({ value: 99, max: 100, at: 0 }, 250_000); expect(e.value).toBe(100); expect(e.at).toBe(250_000);
    const full = regen({ value: 100, max: 100, at: 0 }, 50_000); expect(full.value).toBe(100); expect(full.at).toBe(50_000);
  });
  it("regen below one interval keeps at", () => { expect(regen({ value: 5, max: 100, at: 1_000 }, 120_999).at).toBe(1_000); });
  it("nearestEmpty measures by x and y, not by index, across a row edge", () => {
    const cells = Array(9).fill(null); for (const i of [0, 3, 4, 6]) cells[i] = item("flower", 1);
    expect(indexOf(nearestEmpty(withCells(3, 3, cells), 0, 1), 3)).toBe(1); // index 2 is one index away but 3 steps away
  });
  it("nearestEmpty breaks a tie at the board edge by the lower index", () => {
    const cells = Array(6).fill(null); cells[2] = item("pot", 1);
    expect(indexOf(nearestEmpty(withCells(3, 2, cells), 2, 0), 3)).toBe(1); // 1 and 5 are both one step away
    expect(indexOf(nearestEmpty(createBoard(2, 2), 1, 1), 2)).toBe(3); // an empty origin is its own nearest
  });
  it("undo keeps exactly 20: with 20 records the oldest stays, the 21st drops the first", () => {
    const deepest = (count: number) => {
      let s = history(); for (let i = 0; i < count; i++) s = record(s, createBoard(1, i + 1 > 12 ? 12 : i + 1)); // heights 1..12, then 12
      let r = undo(s), last: any = null, n = 0; while (r) { last = r.board; n++; r = undo(r.stack); }
      return { n, last };
    };
    expect(deepest(20)).toEqual({ n: 20, last: createBoard(1, 1) });
    expect(deepest(21)).toEqual({ n: 20, last: createBoard(1, 2) });
  });
  it("record and undo leave the stack they get unchanged", () => {
    const a = createBoard(1, 1), b = createBoard(2, 1); const s1 = record(history(), a); const s2 = record(s1, b);
    expect(undo(s1)!.board).toEqual(a); undo(s2); expect(undo(s2)!.board).toEqual(b); expect(undo(undo(s2)!.stack)!.board).toEqual(a);
  });
  it("load migrates a v1 save with empty cells as nulls, its size intact", () => {
    const s: any = load(JSON.stringify({ v: 1, cells: [null, null, null, item("flower", 2)], w: 2, h: 2, energy: 0 }));
    expect(s.board).toEqual({ width: 2, height: 2, cells: [null, null, null, item("flower", 2)] }); expect(s.energy).toEqual({ value: 0, max: 100, at: 0 });
    const empty: any = load(JSON.stringify({ v: 1, cells: [null, null], w: 1, h: 2, energy: 5 })); expect(empty.board.cells).toEqual([null, null]); expect(empty.board.height).toBe(2);
  });
  it("drop merges into maxTier, and swaps equal tiers of different kinds", () => {
    const r = drop(withCells(2, 1, [item("flower", 2), item("flower", 2)]), catalog, 1, 0); expect(r.merged).toBe(true); expect(r.board.cells).toEqual([item("flower", 3), null]);
    const s = drop(withCells(2, 1, [item("pot", 1), item("flower", 1)]), catalog, 0, 1); expect(s.merged).toBe(false); expect(s.board.cells).toEqual([item("flower", 1), item("pot", 1)]);
  });
  it("tap places next to the generator, not next to index 0, with one rng call", () => {
    const cells = Array(9).fill(null); cells[8] = item("pot", 1); cells[5] = item("flower", 3); let calls = 0;
    const r = tap(withCells(3, 3, cells), catalog, 8, { value: 2, max: 100, at: 0 }, () => { calls++; return 0; });
    expect(r.produced).toBe(7); expect(r.board.cells[7]).toEqual(item("flower", 1)); expect(r.energy.value).toBe(0); expect(calls).toBe(1);
    let none = 0; tap(withCells(1, 1, [item("pot", 1)]), catalog, 0, { value: 9, max: 100, at: 0 }, () => { none++; return 0; }); expect(none).toBe(0);
  });
  it("fulfil takes repeated needs from the lowest indices and leaves its input alone", () => {
    const b = withCells(4, 1, [item("flower", 2), item("flower", 1), item("flower", 2), item("flower", 2)]);
    const r = fulfil(b, catalog, { id: "d", needs: [item("flower", 2), item("flower", 2)] });
    expect(r.board.cells).toEqual([null, item("flower", 1), null, item("flower", 2)]); expect(r.stars).toBe(6); expect(b.cells[0]).toEqual(item("flower", 2));
  });
});
