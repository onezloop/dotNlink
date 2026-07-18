/**
 * Path model: an immutable snapshot of the drawn path plus derived game status.
 * Every transition returns a new `PathState` — callers never mutate in place,
 * which keeps React re-renders predictable and the model trivially testable.
 */
import { coordsEqual } from './grid';
import { isMoveLegal, isSolved, isUndoMove } from './validation';
import type { Coord, Level } from '@/types/level';

export type GameStatus = 'playing' | 'solved';

export interface PathState {
  readonly path: readonly Coord[];
  readonly status: GameStatus;
}

function firstCheckpoint(level: Level): Coord | undefined {
  return level.checkpoints.find((checkpoint) => checkpoint.order === 1)?.coord;
}

export function createInitialPathState(): PathState {
  return { path: [], status: 'playing' };
}

/** Begin (or restart) the path at the level's first checkpoint. */
export function startPath(level: Level): PathState {
  const start = firstCheckpoint(level);
  if (!start) return createInitialPathState();
  return { path: [start], status: 'playing' };
}

/** Attempt to extend the path to `next`. Returns the same state (no-op) if the
 * move is structurally illegal (wall, revisit, non-adjacent) — checkpoint
 * order is not enforced here, so stepping onto the wrong-numbered checkpoint
 * still extends the path; callers surface that as a visual mistake via
 * `findOrderViolationIndex` instead of blocking the move. */
export function extendPath(state: PathState, level: Level, next: Coord): PathState {
  if (state.status === 'solved') return state;

  if (isUndoMove(state.path, next)) {
    return undoPath(state);
  }

  const legal = isMoveLegal({ level, path: state.path }, next);
  if (!legal) return state;

  const path = [...state.path, next];
  const solved = isSolved({ level, path });
  return { path, status: solved ? 'solved' : 'playing' };
}

/** Pop the path head. */
export function undoPath(state: PathState): PathState {
  if (state.path.length <= 1) return state;
  return { path: state.path.slice(0, -1), status: 'playing' };
}

/** Truncate the path back to (and including) `target`, used when the pointer
 * drags onto an earlier path cell. */
export function truncatePathTo(state: PathState, target: Coord): PathState {
  const index = state.path.findIndex((cell) => coordsEqual(cell, target));
  if (index === -1 || index === state.path.length - 1) return state;
  return { path: state.path.slice(0, index + 1), status: 'playing' };
}
