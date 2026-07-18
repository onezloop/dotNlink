import { describe, expect, it } from 'vitest';

import { solve } from '@/engine/solver';
import levelsRaw from '@/data/levels.json';
import { assertLevels } from '@/types/level';

const levels = assertLevels(levelsRaw);

describe('committed levels.json', () => {
  it('contains exactly 100 levels', () => {
    expect(levels).toHaveLength(100);
  });

  it.each(levels.map((level) => [level.id, level] as const))(
    'level %i has checkpoints ordered 1..N',
    (_id, level) => {
      const orders = [...level.checkpoints.map((cp) => cp.order)].sort((a, b) => a - b);
      expect(orders).toEqual(orders.map((_, index) => index + 1));
    },
  );

  it.each(levels.map((level) => [level.id, level] as const))(
    'level %i solution matches its rows*cols cell count',
    (_id, level) => {
      expect(level.solution).toHaveLength(level.rows * level.cols);
    },
  );

  it.each(levels.map((level) => [level.id, level] as const))(
    'level %i is uniquely solvable and matches its stored solution',
    (_id, level) => {
      const result = solve(level, { countLimit: 2, nodeLimit: 500_000 });
      expect(result.truncated).toBe(false);
      expect(result.count).toBe(1);
      expect(result.solution).toEqual(level.solution);
    },
  );
});
