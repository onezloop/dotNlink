import { describe, expect, it } from 'vitest';

import { solve } from '@/engine/solver';
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
    solution: [],
    ...overrides,
  };
}

describe('solve', () => {
  it('reports exactly one solution for a uniquely-solvable grid', () => {
    const level = makeLevel();
    const result = solve(level, { countLimit: 2 });
    expect(result.count).toBe(1);
    expect(result.solution).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
      { r: 1, c: 0 },
    ]);
  });

  it('reports at least two solutions for an under-constrained grid', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 2, c: 2 }, order: 2 },
      ],
    });
    const result = solve(level, { countLimit: 2 });
    expect(result.count).toBeGreaterThanOrEqual(2);
  });

  it('reports zero solutions when the start cell is walled off', () => {
    const level = makeLevel({
      walls: [
        { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } },
        { a: { r: 0, c: 0 }, b: { r: 1, c: 0 } },
      ],
    });
    const result = solve(level, { countLimit: 2 });
    expect(result.count).toBe(0);
    expect(result.solution).toBeNull();
  });

  it('stops counting once countLimit is reached', () => {
    // (0,0) and (0,3) are opposite-colour corners on the checkerboard, which
    // is a necessary condition for a full-coverage Hamiltonian path to exist
    // between them on an even-area grid.
    const level = makeLevel({
      rows: 4,
      cols: 4,
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 3 }, order: 2 },
      ],
    });
    const limited = solve(level, { countLimit: 1 });
    expect(limited.count).toBe(1);

    const unlimited = solve(level, { countLimit: 1000 });
    expect(unlimited.count).toBeGreaterThan(1);
  });
});
