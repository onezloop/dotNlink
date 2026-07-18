/**
 * Grid geometry: coordinate <-> index mapping, orthogonal adjacency, and wall
 * lookups. Pure, framework-free — no React imports permitted in this module.
 */
import type { Coord, Level, Wall } from '@/types/level';

export function toIndex(coord: Coord, cols: number): number {
  return coord.r * cols + coord.c;
}

export function toCoord(index: number, cols: number): Coord {
  return { r: Math.floor(index / cols), c: index % cols };
}

export function isInBounds(coord: Coord, rows: number, cols: number): boolean {
  return coord.r >= 0 && coord.r < rows && coord.c >= 0 && coord.c < cols;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr + dc === 1;
}

/** Canonical edge key with the smaller endpoint first (reading order), so a
 * wall between A and B always hashes the same regardless of traversal direction. */
export function wallKey(a: Coord, b: Coord): string {
  const [first, second] =
    a.r < b.r || (a.r === b.r && a.c < b.c) ? [a, b] : [b, a];
  return `${first.r},${first.c}|${second.r},${second.c}`;
}

export function buildWallSet(walls: readonly Wall[]): ReadonlySet<string> {
  return new Set(walls.map((wall) => wallKey(wall.a, wall.b)));
}

export function hasWallBetween(
  wallSet: ReadonlySet<string>,
  a: Coord,
  b: Coord,
): boolean {
  return wallSet.has(wallKey(a, b));
}

const DIRECTIONS: readonly Coord[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/** All orthogonal neighbours in-bounds and not separated by a wall. */
export function neighbours(
  coord: Coord,
  rows: number,
  cols: number,
  wallSet: ReadonlySet<string>,
): Coord[] {
  const result: Coord[] = [];
  for (const direction of DIRECTIONS) {
    const candidate: Coord = { r: coord.r + direction.r, c: coord.c + direction.c };
    if (!isInBounds(candidate, rows, cols)) continue;
    if (hasWallBetween(wallSet, coord, candidate)) continue;
    result.push(candidate);
  }
  return result;
}

export function cellCount(level: Pick<Level, 'rows' | 'cols'>): number {
  return level.rows * level.cols;
}
