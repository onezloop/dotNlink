import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createInitialPathState,
  extendPath,
  startPath,
  truncatePathTo,
  undoPath,
} from '@/engine/pathState';
import type { PathState } from '@/engine/pathState';
import { findOrderViolationIndex } from '@/engine/validation';
import type { Coord, Level } from '@/types/level';

export type GameStatus = 'idle' | 'playing' | 'solved';

export interface UseGameResult {
  readonly path: readonly Coord[];
  readonly status: GameStatus;
  /** Index in `path` of the first checkpoint hit out of order, or null if
   * none — surfaced so the UI can highlight the mistake instead of the move
   * having been silently blocked. */
  readonly orderViolationIndex: number | null;
  readonly elapsedMs: number;
  readonly begin: () => void;
  readonly extendTo: (coord: Coord) => void;
  readonly truncateTo: (coord: Coord) => void;
  readonly undo: () => void;
  readonly reset: () => void;
}

/** Drives one level's play session: path state (delegated to the pure
 * `engine/pathState` module) plus a pause-aware elapsed timer. Resets
 * whenever `level.id` changes. */
export function useGame(level: Level): UseGameResult {
  const [pathState, setPathState] = useState<PathState>(() => createInitialPathState());
  const [elapsedMs, setElapsedMs] = useState(0);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    setElapsedMs(accumulatedRef.current + (performance.now() - startedAtRef.current));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const pauseTimer = useCallback(() => {
    if (startedAtRef.current !== null) {
      accumulatedRef.current += performance.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (startedAtRef.current !== null || pathState.status !== 'playing') return;
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [pathState.status, tick]);

  useEffect(() => {
    setPathState(createInitialPathState());
    setElapsedMs(0);
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  useEffect(() => {
    if (pathState.status === 'solved') pauseTimer();
  }, [pathState.status, pauseTimer]);

  useEffect(() => {
    function handleVisibility(): void {
      if (document.hidden) pauseTimer();
      else resumeTimer();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseTimer, resumeTimer]);

  useEffect(() => pauseTimer, [pauseTimer]);

  const begin = useCallback(() => {
    if (pathState.path.length > 0) return;
    setPathState(startPath(level));
    accumulatedRef.current = 0;
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [level, pathState.path.length, tick]);

  const extendTo = useCallback(
    (coord: Coord) => {
      setPathState((previous) => extendPath(previous, level, coord));
    },
    [level],
  );

  const truncateTo = useCallback((coord: Coord) => {
    setPathState((previous) => truncatePathTo(previous, coord));
  }, []);

  const undo = useCallback(() => {
    setPathState((previous) => undoPath(previous));
  }, []);

  const reset = useCallback(() => {
    pauseTimer();
    setPathState(createInitialPathState());
    setElapsedMs(0);
    accumulatedRef.current = 0;
    startedAtRef.current = null;
  }, [pauseTimer]);

  const status: GameStatus = pathState.path.length === 0 ? 'idle' : pathState.status;
  const orderViolationIndex = findOrderViolationIndex(level, pathState.path);

  return {
    path: pathState.path,
    status,
    orderViolationIndex,
    elapsedMs,
    begin,
    extendTo,
    truncateTo,
    undo,
    reset,
  };
}
