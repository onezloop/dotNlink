import { describe, expect, it } from 'vitest';

import { extendPath, startPath, undoPath } from '@/engine/pathState';
import { findOrderViolationIndex, isMoveLegal, isSolved } from '@/engine/validation';
import type { Level } from '@/types/level';

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    rows: 2,
    cols: 2,
    difficulty: 'easy',
    checkpoints: [
      { coord: { r: 0, c: 0 }, order: 1 },
      { coord: { r: 1, c: 0 }, order: 2 },
    ],
    walls: [],
    solution: [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
      { r: 1, c: 0 },
    ],
    ...overrides,
  };
}

describe('isMoveLegal', () => {
  it('rejects non-adjacent moves', () => {
    const level = makeLevel();
    const legal = isMoveLegal({ level, path: [{ r: 0, c: 0 }] }, { r: 1, c: 1 });
    expect(legal).toBe(false);
  });

  it('rejects moves across a wall', () => {
    const level = makeLevel({
      walls: [{ a: { r: 0, c: 0 }, b: { r: 0, c: 1 } }],
    });
    const legal = isMoveLegal({ level, path: [{ r: 0, c: 0 }] }, { r: 0, c: 1 });
    expect(legal).toBe(false);
  });

  it('rejects revisiting an already-visited cell', () => {
    const level = makeLevel();
    const legal = isMoveLegal(
      {
        level,
        path: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
        ],
      },
      { r: 0, c: 0 },
    );
    expect(legal).toBe(false);
  });

  it('allows stepping onto a checkpoint out of order (not a structural block)', () => {
    const level = makeLevel({
      rows: 1,
      cols: 3,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 1 }, order: 5 },
      ],
    });
    const legal = isMoveLegal({ level, path: [{ r: 0, c: 0 }] }, { r: 0, c: 1 });
    // (0,1) is adjacent and unvisited; its checkpoint order (5) doesn't match
    // what's "expected" next, but that's a mistake to flag, not a blocked move.
    expect(legal).toBe(true);
  });

  it('accepts a legal adjacent move onto a non-checkpoint cell', () => {
    const level = makeLevel();
    const legal = isMoveLegal({ level, path: [{ r: 0, c: 0 }] }, { r: 0, c: 1 });
    expect(legal).toBe(true);
  });
});

describe('findOrderViolationIndex', () => {
  it('is null when checkpoints are hit in ascending order', () => {
    const level = makeLevel();
    const violation = findOrderViolationIndex(level, [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
      { r: 1, c: 0 },
    ]);
    expect(violation).toBeNull();
  });

  it('reports the index of the first checkpoint hit out of order', () => {
    // Checkpoint 3 sits between checkpoints 1 and 2 on a straight row, so
    // walking toward 2 passes through 3 first.
    const level = makeLevel({
      rows: 1,
      cols: 5,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 4 }, order: 2 },
        { coord: { r: 0, c: 2 }, order: 3 },
      ],
    });
    const violation = findOrderViolationIndex(level, [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 }, // checkpoint 3, but checkpoint 2 was expected next
    ]);
    expect(violation).toBe(2);
  });
});

describe('path state transitions', () => {
  it('walks the full Hamiltonian path to a solved state', () => {
    const level = makeLevel();
    let state = startPath(level);
    expect(state.path).toEqual([{ r: 0, c: 0 }]);

    state = extendPath(state, level, { r: 0, c: 1 });
    expect(state.status).toBe('playing');

    state = extendPath(state, level, { r: 1, c: 1 });
    expect(state.status).toBe('playing');

    state = extendPath(state, level, { r: 1, c: 0 });
    expect(state.status).toBe('solved');
    expect(state.path).toHaveLength(4);
  });

  it('ignores structurally illegal moves and leaves state unchanged', () => {
    const level = makeLevel();
    const state = startPath(level);
    const next = extendPath(state, level, { r: 1, c: 1 });
    expect(next).toEqual(state);
  });

  it('allows an out-of-order checkpoint move and never marks it solved', () => {
    const level = makeLevel({
      rows: 1,
      cols: 5,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 4 }, order: 2 },
        { coord: { r: 0, c: 2 }, order: 3 },
      ],
    });
    let state = startPath(level);
    state = extendPath(state, level, { r: 0, c: 1 });
    state = extendPath(state, level, { r: 0, c: 2 }); // checkpoint 3 early
    expect(state.path).toHaveLength(3);
    expect(state.status).toBe('playing');
    expect(findOrderViolationIndex(level, state.path)).toBe(2);
  });

  it('undo pops the head', () => {
    const level = makeLevel();
    let state = startPath(level);
    state = extendPath(state, level, { r: 0, c: 1 });
    state = extendPath(state, level, { r: 1, c: 1 });
    state = extendPath(state, level, { r: 1, c: 0 }); // solved

    const undone = undoPath(state);
    expect(undone.status).toBe('playing');
    expect(undone.path).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ]);
  });

  it('dragging back onto the previous cell acts as an undo', () => {
    const level = makeLevel();
    let state = startPath(level);
    state = extendPath(state, level, { r: 0, c: 1 });
    const backOnStart = extendPath(state, level, { r: 0, c: 0 });
    expect(backOnStart.path).toEqual([{ r: 0, c: 0 }]);
  });
});

describe('isSolved', () => {
  it('is false when path does not cover every cell', () => {
    const level = makeLevel();
    const solved = isSolved({
      level,
      path: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    expect(solved).toBe(false);
  });

  it('is false when the path ends on a non-final checkpoint cell', () => {
    const level = makeLevel();
    const solved = isSolved({
      level,
      path: [
        { r: 1, c: 0 },
        { r: 1, c: 1 },
        { r: 0, c: 1 },
        { r: 0, c: 0 },
      ],
    });
    expect(solved).toBe(false);
  });

  it('is false when the path fills the grid but has an unresolved order violation', () => {
    // Same 2x2 level, but arriving at the end via a path that would hit
    // checkpoint 2 before it's actually reached — here we simulate a filled
    // path whose checkpoint sequence is out of order by relabelling checkpoint
    // order on a 3-checkpoint variant.
    const level = makeLevel({
      rows: 1,
      cols: 4,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 3 }, order: 2 },
        { coord: { r: 0, c: 1 }, order: 3 },
      ],
    });
    const path = [
      { r: 0, c: 0 },
      { r: 0, c: 1 }, // checkpoint 3 hit before checkpoint 2 — violation
      { r: 0, c: 2 },
      { r: 0, c: 3 }, // ends on max checkpoint, and covers every cell
    ];
    expect(isSolved({ level, path })).toBe(false);
    expect(findOrderViolationIndex(level, path)).toBe(1);
  });
});
