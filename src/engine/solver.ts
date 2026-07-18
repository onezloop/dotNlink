/**
 * Backtracking Hamiltonian-path solver used both to validate generated levels
 * (uniqueness gate) and by the generator's checkpoint/wall carving.
 * Not exposed as an in-game hint — import only from build tooling and tests.
 *
 * Internally everything after setup works on integer cell indices with a
 * precomputed adjacency list, rather than re-deriving neighbours (Coord
 * objects, wall-key strings, Set lookups) on every DFS step and every
 * flood-fill visit. On a fixed (rows, cols, walls) shape that per-call
 * derivation was pure repeated work — precomputing it once per `solve()`
 * call is what makes the uniqueness gate tractable on 8x8/9x9 grids, where
 * "near miss" (almost-but-not-quite-unique) levels otherwise force deep,
 * allocation-heavy searches.
 */
import { buildWallSet, cellCount, neighbours, toCoord, toIndex } from './grid';
import type { Coord, Level } from '@/types/level';

export interface SolveOptions {
  readonly countLimit: number;
  /** Caps total DFS node expansions. Used by the generator to bail out of
   * pathological searches on sparse large grids rather than hang; the
   * runtime/tests never need it. When exceeded, `truncated` is set on the
   * result and `count` reflects only what was found before the cutoff. */
  readonly nodeLimit?: number;
}

export interface SolveResult {
  readonly count: number;
  readonly solution: readonly Coord[] | null;
  readonly truncated: boolean;
  /** DFS node expansions performed. Used as a branch-count proxy for human
   * difficulty when scoring generated levels. */
  readonly nodesExplored: number;
}

/**
 * Counts Hamiltonian paths starting at checkpoint 1 that visit every cell,
 * hit all checkpoints in ascending order, and end on the highest checkpoint.
 * Stops early once `countLimit` is reached, which is what keeps the
 * uniqueness gate (`countLimit: 2`) fast even on 9x9 grids.
 *
 * Pruning:
 *  - Checkpoint order: a checkpoint cell may only be entered when its order
 *    matches the next expected order.
 *  - Connectivity: after each step, flood-fill the remaining unvisited region
 *    from the new head through unvisited cells only. If it doesn't cover
 *    every unvisited cell, the region has been split by the path itself and
 *    no Hamiltonian completion is possible from here — prune. A cell with no
 *    unvisited neighbours (a dead end) is simply unreachable under this
 *    check, so no separate degree-1 rule is needed.
 */
export function solve(level: Level, options: SolveOptions): SolveResult {
  const { rows, cols } = level;
  const total = cellCount(level);
  const wallSet = buildWallSet(level.walls);

  const orderByIndex = new Int16Array(total).fill(-1);
  let maxOrder = 0;
  for (const checkpoint of level.checkpoints) {
    const idx = toIndex(checkpoint.coord, cols);
    orderByIndex[idx] = checkpoint.order;
    maxOrder = Math.max(maxOrder, checkpoint.order);
  }

  const startCheckpoint = level.checkpoints.find((checkpoint) => checkpoint.order === 1);
  if (!startCheckpoint || maxOrder === 0) {
    return { count: 0, solution: null, truncated: false, nodesExplored: 0 };
  }
  const startIndex = toIndex(startCheckpoint.coord, cols);

  // Adjacency (wall-aware), computed once per call instead of per DFS step.
  const adjacency = new Array<number[]>(total);
  for (let idx = 0; idx < total; idx += 1) {
    adjacency[idx] = neighbours(toCoord(idx, cols), rows, cols, wallSet).map((n) =>
      toIndex(n, cols),
    );
  }

  const visited = new Uint8Array(total);
  const pathIndices: number[] = [startIndex];
  visited[startIndex] = 1;

  let count = 0;
  let nodesExplored = 0;
  let truncated = false;
  // Boxed so TS doesn't narrow this to its initial `null` at the read below —
  // it's only ever reassigned from inside the `dfs` closure.
  const firstSolution: { indices: number[] | null } = { indices: null };

  // Reused scratch buffers for flood-fill, avoiding a fresh Set per call.
  const floodSeen = new Uint8Array(total);
  const floodStack: number[] = [];

  function floodFillReachable(headIdx: number, remaining: number): boolean {
    if (remaining === 0) return true;
    floodSeen.fill(0);
    floodStack.length = 0;
    floodStack.push(headIdx);
    floodSeen[headIdx] = 1;
    let reachableUnvisited = 0;

    while (floodStack.length > 0) {
      const current = floodStack.pop();
      if (current === undefined) continue;
      for (const neighbourIdx of adjacency[current]!) {
        if (floodSeen[neighbourIdx]) continue;
        floodSeen[neighbourIdx] = 1;
        if (!visited[neighbourIdx]) {
          reachableUnvisited += 1;
          floodStack.push(neighbourIdx);
        }
      }
    }

    return reachableUnvisited === remaining;
  }

  function dfs(headIdx: number, nextExpectedOrder: number): void {
    if (count >= options.countLimit || truncated) return;

    if (options.nodeLimit !== undefined && nodesExplored >= options.nodeLimit) {
      truncated = true;
      return;
    }
    nodesExplored += 1;

    if (pathIndices.length === total) {
      const order = orderByIndex[headIdx];
      if (order === maxOrder && nextExpectedOrder > maxOrder) {
        count += 1;
        firstSolution.indices ??= [...pathIndices];
      }
      return;
    }

    for (const nextIdx of adjacency[headIdx]!) {
      if (count >= options.countLimit || truncated) return;
      if (visited[nextIdx]) continue;

      const order = orderByIndex[nextIdx];
      if (order !== -1 && order !== nextExpectedOrder) continue;

      visited[nextIdx] = 1;
      pathIndices.push(nextIdx);

      const remaining = total - pathIndices.length;
      if (floodFillReachable(nextIdx, remaining)) {
        const advanced = order === nextExpectedOrder ? nextExpectedOrder + 1 : nextExpectedOrder;
        dfs(nextIdx, advanced);
      }

      pathIndices.pop();
      visited[nextIdx] = 0;
    }
  }

  dfs(startIndex, 2);

  const solution = firstSolution.indices?.map((idx) => toCoord(idx, cols)) ?? null;

  return { count, solution, truncated, nodesExplored };
}

export function hasUniqueSolution(level: Level): boolean {
  const result = solve(level, { countLimit: 2 });
  return !result.truncated && result.count === 1;
}
