import { describe, expect, it } from 'vitest';

import { pathHueForLevel } from '@/utils/pathColor';
import { PATH_SWEEP_PULSE_MS, PATH_SWEEP_STAGGER_MS, winModalDelayMs } from '@/utils/solvedHighlight';

describe('pathHueForLevel', () => {
  it('is deterministic for a given level id', () => {
    expect(pathHueForLevel(42)).toBe(pathHueForLevel(42));
  });

  it('returns a valid hue degree', () => {
    for (let id = 1; id <= 100; id += 1) {
      const hue = pathHueForLevel(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('varies across consecutive levels', () => {
    const hues = new Set(Array.from({ length: 10 }, (_, i) => pathHueForLevel(i + 1)));
    expect(hues.size).toBeGreaterThan(1);
  });
});

describe('winModalDelayMs', () => {
  it('grows with path length, staggered by PATH_SWEEP_STAGGER_MS per segment', () => {
    const short = winModalDelayMs(4);
    const long = winModalDelayMs(81);
    expect(long - short).toBe((81 - 4) * PATH_SWEEP_STAGGER_MS);
  });

  it('never returns less than the base pulse duration', () => {
    expect(winModalDelayMs(0)).toBeGreaterThanOrEqual(PATH_SWEEP_PULSE_MS);
    expect(winModalDelayMs(1)).toBeGreaterThanOrEqual(PATH_SWEEP_PULSE_MS);
  });
});
