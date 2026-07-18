/**
 * Move legality and win detection. Pure functions over `Level` + path state —
 * no mutation, no React imports. Shared by the runtime hook and component tests.
 */
import { buildWallSet, coordsEqual, hasWallBetween, isAdjacent, toIndex } from './grid';
import type { Coord, Level } from '@/types/level';

export interface MoveContext {
  readonly level: Level;
  readonly path: readonly Coord[];
}

function checkpointOrderAt(level: Level, coord: Coord): number | undefined {
  return level.checkpoints.find((checkpoint) => coordsEqual(checkpoint.coord, coord))
    ?.order;
}

/** Whether stepping from the current path head onto `next` is a legal forward
 * move (undo is handled separately by the caller via `isUndoMove`).
 *
 * Only the *structural* rules are hard blocks here: orthogonal adjacency, no
 * wall on the edge, and no revisiting a cell. Checkpoint order is
 * deliberately NOT enforced — a player may step onto a checkpoint out of
 * sequence, and `findOrderViolationIndex` flags that as a mistake to notice
 * and correct rather than the move being silently refused. */
export function isMoveLegal(context: MoveContext, next: Coord): boolean {
  const { level, path } = context;
  const head = path[path.length - 1];
  if (!head) return path.length === 0 && checkpointOrderAt(level, next) === 1;

  if (!isAdjacent(head, next)) return false;

  const wallSet = buildWallSet(level.walls);
  if (hasWallBetween(wallSet, head, next)) return false;

  const alreadyVisited = path.some((cell) => coordsEqual(cell, next));
  if (alreadyVisited) return false;

  return true;
}

/** Index (within `path`) of the first checkpoint visited out of ascending
 * order, or `null` if every checkpoint hit so far is in sequence. Everything
 * from this index onward is a "wrong turn" the player should backtrack past
 * before the level can be solved. */
export function findOrderViolationIndex(
  level: Level,
  path: readonly Coord[],
): number | null {
  let expected = 1;
  for (let index = 0; index < path.length; index += 1) {
    const order = checkpointOrderAt(level, path[index]!);
    if (order === undefined) continue;
    if (order === expected) {
      expected += 1;
    } else {
      return index;
    }
  }
  return null;
}

/** Dragging back onto the immediately-previous path cell is treated as an undo. */
export function isUndoMove(path: readonly Coord[], next: Coord): boolean {
  const previous = path[path.length - 2];
  return previous !== undefined && coordsEqual(previous, next);
}

export function maxCheckpointOrder(level: Level): number {
  return level.checkpoints.reduce((max, cp) => Math.max(max, cp.order), 0);
}

export interface WinCheckContext {
  readonly level: Level;
  readonly path: readonly Coord[];
}

/** A level is solved once the path covers every cell, ends on the highest-order
 * checkpoint, and every checkpoint was hit in order along the way — a path
 * with an unresolved order violation (see `findOrderViolationIndex`) never
 * counts as solved, even once it fills the grid. */
export function isSolved(context: WinCheckContext): boolean {
  const { level, path } = context;
  const totalCells = level.rows * level.cols;
  if (path.length !== totalCells) return false;

  const head = path[path.length - 1];
  if (!head) return false;

  const finalOrder = checkpointOrderAt(level, head);
  const maxOrder = maxCheckpointOrder(level);
  if (finalOrder !== maxOrder) return false;

  return findOrderViolationIndex(level, path) === null;
}

export function pathToIndexSet(path: readonly Coord[], cols: number): ReadonlySet<number> {
  return new Set(path.map((coord) => toIndex(coord, cols)));
}
