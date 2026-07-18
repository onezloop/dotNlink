/**
 * Persisted player progress: completed levels, best times, last played, and
 * theme preference. Backed by localStorage via `useLocalStorage`; corrupt or
 * missing storage falls back to `INITIAL_PROGRESS` rather than crashing.
 */
import { useCallback } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';

export type Theme = 'light' | 'dark';

export interface Progress {
  readonly completed: readonly number[];
  readonly bestTimeMs: Readonly<Record<number, number>>;
  readonly lastPlayed: number | null;
  readonly theme: Theme | null; // null = follow system preference
}

export const INITIAL_PROGRESS: Progress = {
  completed: [],
  bestTimeMs: {},
  lastPlayed: null,
  theme: null,
};

const STORAGE_KEY = 'dotnlink.progress.v1';

/** Marks `levelId` completed and records `timeMs` as the best time if it
 * beats (or is the first) previous best. Pure — returns a new Progress. */
export function recordCompletion(
  progress: Progress,
  levelId: number,
  timeMs: number,
  now: number,
): Progress {
  const completed = progress.completed.includes(levelId)
    ? progress.completed
    : [...progress.completed, levelId].sort((a, b) => a - b);

  const previousBest = progress.bestTimeMs[levelId];
  const bestTimeMs =
    previousBest === undefined || timeMs < previousBest
      ? { ...progress.bestTimeMs, [levelId]: timeMs }
      : progress.bestTimeMs;

  return { ...progress, completed, bestTimeMs, lastPlayed: now };
}

export function isLevelCompleted(progress: Progress, levelId: number): boolean {
  return progress.completed.includes(levelId);
}

/** Level 1 is always unlocked; every other level requires its predecessor to
 * be completed first — the player must clear levels in order. */
export function isLevelUnlocked(progress: Progress, levelId: number): boolean {
  return levelId === 1 || isLevelCompleted(progress, levelId - 1);
}

export function useProgress(): {
  progress: Progress;
  complete: (levelId: number, timeMs: number, now: number) => void;
  setTheme: (theme: Theme) => void;
} {
  const [progress, setProgress] = useLocalStorage<Progress>(STORAGE_KEY, INITIAL_PROGRESS);

  const complete = useCallback(
    (levelId: number, timeMs: number, now: number) => {
      setProgress((previous) => recordCompletion(previous, levelId, timeMs, now));
    },
    [setProgress],
  );

  const setTheme = useCallback(
    (theme: Theme) => {
      setProgress((previous) => ({ ...previous, theme }));
    },
    [setProgress],
  );

  return { progress, complete, setTheme };
}
