export interface Coord {
  readonly r: number;
  readonly c: number;
}

/** Wall between two orthogonally-adjacent cells. Normalized so `a` sorts before
 * `b` in (r,c) reading order to keep lookups canonical. */
export interface Wall {
  readonly a: Coord;
  readonly b: Coord;
}

export interface Checkpoint {
  readonly coord: Coord;
  readonly order: number; // 1..N
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Level {
  readonly id: number; // 1..50
  readonly rows: number;
  readonly cols: number;
  readonly checkpoints: readonly Checkpoint[]; // sorted by order
  readonly walls: readonly Wall[];
  readonly difficulty: Difficulty;
  /** Full Hamiltonian path, length = rows*cols. Used by verify-levels.ts and dev
   * tooling only — the client never reads this at runtime. */
  readonly solution: readonly Coord[];
}

export function isCoord(value: unknown): value is Coord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Coord).r === 'number' &&
    typeof (value as Coord).c === 'number'
  );
}

function isWall(value: unknown): value is Wall {
  return (
    typeof value === 'object' &&
    value !== null &&
    isCoord((value as Wall).a) &&
    isCoord((value as Wall).b)
  );
}

function isCheckpoint(value: unknown): value is Checkpoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    isCoord((value as Checkpoint).coord) &&
    typeof (value as Checkpoint).order === 'number'
  );
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** Runtime guard for `levels.json` so a malformed level fails loudly at load time
 * rather than corrupting game state silently. */
export function isLevel(value: unknown): value is Level {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Level;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.rows === 'number' &&
    typeof candidate.cols === 'number' &&
    Array.isArray(candidate.checkpoints) &&
    candidate.checkpoints.every(isCheckpoint) &&
    Array.isArray(candidate.walls) &&
    candidate.walls.every(isWall) &&
    DIFFICULTIES.includes(candidate.difficulty) &&
    Array.isArray(candidate.solution) &&
    candidate.solution.every(isCoord)
  );
}

export function assertLevels(value: unknown): Level[] {
  if (!Array.isArray(value) || !value.every(isLevel)) {
    throw new Error('levels.json failed shape validation: expected Level[]');
  }
  return value;
}
