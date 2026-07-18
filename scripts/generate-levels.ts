/**
 * Level generator. Produces 100 levels of growing difficulty and
 * writes them to `src/data/levels.json`. Not shipped to the client — run via
 * `npm run gen:levels`.
 *
 * Phase A seeds a random Hamiltonian path (the intended solution) over an
 * open grid. Phase B derives checkpoints from that path. Phase C carves walls
 * from edges the path never used. Phase D is the uniqueness gate: keep
 * strengthening (more checkpoints, then more walls) until `solve` reports
 * exactly one solution, or reseed Phase A on exhaustion.
 *
 * The difficulty table below is an indicative starting point, not a hard
 * constraint — the one rule that cannot bend is that each level has exactly
 * one valid solution. On small, wall-free
 * grids an open board rarely has a unique Hamiltonian path between two fixed
 * endpoints, so this generator is allowed to grow the checkpoint count (and,
 * once a tier allows it, the wall count) beyond the table's suggested range
 * in order to satisfy uniqueness. Every deviation is logged.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { neighbours, toIndex } from '../src/engine/grid';
import { solve } from '../src/engine/solver';
import type { Checkpoint, Coord, Difficulty, Level, Wall } from '../src/types/level';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/levels.json');
const SEED = 20240517; // fixed so levels.json is reproducible

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

function randomInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

// ---------------------------------------------------------------------------
// Phase A — random Hamiltonian path via Warnsdorff-guided randomized backtracking
// ---------------------------------------------------------------------------
const emptyWallSet = new Set<string>();

function randomHamiltonianPath(
  rows: number,
  cols: number,
  rng: () => number,
): Coord[] | null {
  const total = rows * cols;
  const visited = new Uint8Array(total);
  const path: Coord[] = [];
  const maxNodes = total * 400;
  let nodesExplored = 0;

  function unvisitedDegree(coord: Coord): number {
    return neighbours(coord, rows, cols, emptyWallSet).filter(
      (n) => !visited[toIndex(n, cols)],
    ).length;
  }

  function dfs(current: Coord): boolean {
    visited[toIndex(current, cols)] = 1;
    path.push(current);
    nodesExplored += 1;

    if (path.length === total) return true;
    if (nodesExplored > maxNodes) return false;

    const candidates = shuffle(
      neighbours(current, rows, cols, emptyWallSet).filter(
        (n) => !visited[toIndex(n, cols)],
      ),
      rng,
    );
    // Warnsdorff's rule: try the most-constrained neighbour first to reduce backtracking.
    candidates.sort((a, b) => unvisitedDegree(a) - unvisitedDegree(b));

    for (const next of candidates) {
      if (dfs(next)) return true;
    }

    visited[toIndex(current, cols)] = 0;
    path.pop();
    return false;
  }

  const start: Coord = { r: randomInt(rng, 0, rows - 1), c: randomInt(rng, 0, cols - 1) };
  return dfs(start) ? path : null;
}

// ---------------------------------------------------------------------------
// Phase B — derive checkpoints from evenly-spaced (with jitter) path indices
// ---------------------------------------------------------------------------
function deriveCheckpoints(
  solutionPath: readonly Coord[],
  checkpointCount: number,
  rng: () => number,
): Checkpoint[] {
  const total = solutionPath.length;
  const targetCount = Math.max(2, Math.min(checkpointCount, total));

  // Evenly-spaced indices across [0, total-1], first and last pinned, with a
  // small random jitter on the interior ones (deduped + re-sorted after).
  const indices = new Set<number>([0, total - 1]);
  for (let i = 1; i < targetCount - 1; i += 1) {
    const base = Math.round((i * (total - 1)) / (targetCount - 1));
    const jitter = randomInt(rng, -1, 1);
    const clamped = Math.min(total - 2, Math.max(1, base + jitter));
    indices.add(clamped);
  }

  const sortedIndices = [...indices].sort((a, b) => a - b);
  return sortedIndices.map((index, order) => ({
    coord: solutionPath[index]!,
    order: order + 1,
  }));
}

// ---------------------------------------------------------------------------
// Phase C — wall candidates: grid edges the solution path never traverses
// ---------------------------------------------------------------------------
function usedEdgeKeys(solutionPath: readonly Coord[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < solutionPath.length - 1; i += 1) {
    const a = solutionPath[i]!;
    const b = solutionPath[i + 1]!;
    const [first, second] = a.r < b.r || (a.r === b.r && a.c < b.c) ? [a, b] : [b, a];
    keys.add(`${first.r},${first.c}|${second.r},${second.c}`);
  }
  return keys;
}

function candidateWalls(rows: number, cols: number, solutionPath: readonly Coord[]): Wall[] {
  const used = usedEdgeKeys(solutionPath);
  const walls: Wall[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const coord: Coord = { r, c };
      const right: Coord = { r, c: c + 1 };
      const down: Coord = { r: r + 1, c };
      if (c + 1 < cols) {
        const key = `${r},${c}|${r},${c + 1}`;
        if (!used.has(key)) walls.push({ a: coord, b: right });
      }
      if (r + 1 < rows) {
        const key = `${r},${c}|${r + 1},${c}`;
        if (!used.has(key)) walls.push({ a: coord, b: down });
      }
    }
  }
  return walls;
}

// ---------------------------------------------------------------------------
// Difficulty scoring
// ---------------------------------------------------------------------------
function difficultyScore(level: Level, solverNodesExplored: number): number {
  const area = level.rows * level.cols;
  const w1 = 1;
  const w2 = 4;
  const w3 = 6;
  const w4 = 0.01;
  return (
    w1 * area +
    w2 * level.walls.length +
    w3 * (area / level.checkpoints.length) +
    w4 * solverNodesExplored
  );
}

// ---------------------------------------------------------------------------
// Tier configuration — a starting point; see module docstring.
// ---------------------------------------------------------------------------
interface Tier {
  readonly idStart: number;
  readonly idEnd: number;
  readonly rows: number;
  readonly cols: number;
  readonly checkpointRange: readonly [number, number];
  readonly wallRange: readonly [number, number];
  readonly difficultyForId: (id: number) => Difficulty;
}

const TIERS: readonly Tier[] = [
  {
    idStart: 1,
    idEnd: 10,
    rows: 5,
    cols: 5,
    checkpointRange: [2, 3],
    wallRange: [0, 0],
    difficultyForId: () => 'easy',
  },
  {
    idStart: 11,
    idEnd: 20,
    rows: 5,
    cols: 5,
    checkpointRange: [3, 4],
    wallRange: [0, 1],
    difficultyForId: (id) => (id <= 15 ? 'easy' : 'medium'),
  },
  {
    idStart: 21,
    idEnd: 30,
    rows: 6,
    cols: 6,
    checkpointRange: [3, 5],
    wallRange: [0, 3],
    difficultyForId: () => 'medium',
  },
  {
    idStart: 31,
    idEnd: 40,
    rows: 6,
    cols: 6,
    checkpointRange: [4, 5],
    wallRange: [1, 4],
    difficultyForId: () => 'medium',
  },
  {
    idStart: 41,
    idEnd: 50,
    rows: 7,
    cols: 7,
    checkpointRange: [4, 6],
    wallRange: [2, 5],
    difficultyForId: () => 'medium',
  },
  {
    idStart: 51,
    idEnd: 60,
    rows: 7,
    cols: 7,
    checkpointRange: [5, 7],
    wallRange: [3, 6],
    difficultyForId: (id) => (id <= 55 ? 'medium' : 'hard'),
  },
  {
    idStart: 61,
    idEnd: 70,
    rows: 8,
    cols: 8,
    checkpointRange: [5, 7],
    wallRange: [4, 8],
    difficultyForId: () => 'hard',
  },
  {
    idStart: 71,
    idEnd: 80,
    rows: 8,
    cols: 8,
    checkpointRange: [6, 8],
    wallRange: [5, 9],
    difficultyForId: () => 'hard',
  },
  {
    idStart: 81,
    idEnd: 90,
    rows: 9,
    cols: 9,
    checkpointRange: [6, 8],
    wallRange: [6, 10],
    difficultyForId: (id) => (id <= 85 ? 'hard' : 'expert'),
  },
  {
    idStart: 91,
    idEnd: 100,
    rows: 9,
    cols: 9,
    checkpointRange: [7, 9],
    wallRange: [7, 12],
    difficultyForId: () => 'expert',
  },
];

function tierFor(id: number): Tier {
  const tier = TIERS.find((t) => id >= t.idStart && id <= t.idEnd);
  if (!tier) throw new Error(`No tier configured for level id ${id}`);
  return tier;
}

// ---------------------------------------------------------------------------
// Generation of a single level
// ---------------------------------------------------------------------------
const NODE_LIMIT = 150_000;
const ATTEMPTS_PER_CHECKPOINT_COUNT = 25;

/** Canonical string for a solution path, used as the cross-level de-dup key so
 * two levels never ship the same Hamiltonian path (which plays identically even
 * when their checkpoints/walls differ). */
function solutionKey(solutionPath: readonly Coord[]): string {
  return solutionPath.map((coord) => `${coord.r},${coord.c}`).join('>');
}

interface GeneratedLevel {
  readonly level: Level;
  readonly solverNodesExplored: number;
}

function buildCandidateLevel(
  id: number,
  tier: Tier,
  checkpointCount: number,
  rng: () => number,
): { level: Level; solutionPath: Coord[] } | null {
  const solutionPath = randomHamiltonianPath(tier.rows, tier.cols, rng);
  if (!solutionPath) return null;

  const checkpoints = deriveCheckpoints(solutionPath, checkpointCount, rng);
  const level: Level = {
    id,
    rows: tier.rows,
    cols: tier.cols,
    checkpoints,
    walls: [],
    difficulty: tier.difficultyForId(id),
    solution: solutionPath,
  };
  return { level, solutionPath };
}

/** Adds walls one at a time from the shuffled candidate pool, re-checking
 * uniqueness after each addition, until unique, the wall budget for this
 * attempt is spent, or candidates run out. */
function carveWallsForUniqueness(
  level: Level,
  solutionPath: readonly Coord[],
  maxWalls: number,
  rng: () => number,
): { level: Level; nodesExplored: number } {
  const candidates = shuffle(candidateWalls(level.rows, level.cols, solutionPath), rng);
  let walls: Wall[] = [];
  let lastResult = solve({ ...level, walls }, { countLimit: 2, nodeLimit: NODE_LIMIT });

  for (const wall of candidates) {
    if (walls.length >= maxWalls || (!lastResult.truncated && lastResult.count === 1)) break;
    walls = [...walls, wall];
    lastResult = solve({ ...level, walls }, { countLimit: 2, nodeLimit: NODE_LIMIT });
  }

  return { level: { ...level, walls }, nodesExplored: lastResult.nodesExplored };
}

function generateLevel(
  id: number,
  rng: () => number,
  usedSolutions: Set<string>,
): GeneratedLevel {
  const tier = tierFor(id);
  const [minCp, maxCp] = tier.checkpointRange;
  const [, maxWalls] = tier.wallRange;
  const total = tier.rows * tier.cols;
  const hardCeiling = total - 2;

  // Empirically, an open or lightly-walled grid
  // needs checkpoints covering roughly a fifth of its cells before a unique
  // Hamiltonian path becomes likely at all — climbing the ladder one at a
  // time from the table's tiny minimum wastes whole attempt budgets on
  // densities that (for 6x6+ grids) essentially never converge.
  const startingCheckpointCount = Math.max(minCp, Math.round(total * 0.18));

  // Escalation ladder: start near that heuristic density, then climb one at a
  // time if it still isn't enough. A small per-count attempt budget fails
  // fast and moves on rather than burning attempts on a hopeless count.
  for (
    let checkpointCount = startingCheckpointCount;
    checkpointCount <= hardCeiling;
    checkpointCount += 1
  ) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_CHECKPOINT_COUNT; attempt += 1) {
      const candidate = buildCandidateLevel(id, tier, checkpointCount, rng);
      if (!candidate) continue;

      const { level, solutionPath } = candidate;
      // Cross-level uniqueness gate: reject a path already used by an earlier
      // level so no two levels ship the same solution (they would play
      // identically). Carving walls never changes the solution path, so this
      // key is stable and can be checked before the wall/uniqueness work.
      if (usedSolutions.has(solutionKey(solutionPath))) continue;

      const withWalls = carveWallsForUniqueness(level, solutionPath, maxWalls, rng);

      const finalCheck = solve(withWalls.level, { countLimit: 2, nodeLimit: NODE_LIMIT });
      if (!finalCheck.truncated && finalCheck.count === 1) {
        if (checkpointCount > maxCp || withWalls.level.walls.length > maxWalls) {
          console.warn(
            `[level ${id}] deviated from table (checkpoints=${checkpointCount}, walls=${withWalls.level.walls.length}) to reach uniqueness`,
          );
        }
        usedSolutions.add(solutionKey(solutionPath));
        return { level: withWalls.level, solverNodesExplored: finalCheck.nodesExplored };
      }
    }
  }

  throw new Error(
    `Failed to generate a uniquely-solvable level ${id} after exhausting the escalation ladder`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const rng = mulberry32(SEED);
  const generated: GeneratedLevel[] = [];
  // Solution paths already committed to, shared across all levels so no two
  // ship the same Hamiltonian path.
  const usedSolutions = new Set<string>();

  for (let id = 1; id <= 100; id += 1) {
    process.stdout.write(`Generating level ${id}/100...\n`);
    const startedAt = Date.now();
    const result = generateLevel(id, rng, usedSolutions);
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write(`  -> done in ${seconds}s\n`);
    generated.push(result);
  }

  // Difficulty score is used only to sanity-check monotonicity within a tier;
  // ids stay fixed 1..100 (tier bands already encode the curve).
  const scored = generated.map((g) => ({
    id: g.level.id,
    score: difficultyScore(g.level, g.solverNodesExplored),
  }));
  for (let i = 1; i < scored.length; i += 1) {
    const prev = scored[i - 1]!;
    const curr = scored[i]!;
    if (tierFor(prev.id) === tierFor(curr.id) && curr.score + 5 < prev.score) {
      console.warn(
        `Difficulty dip within tier: level ${curr.id} (score ${curr.score.toFixed(1)}) easier than level ${prev.id} (score ${prev.score.toFixed(1)})`,
      );
    }
  }

  const levels = generated.map((g) => g.level);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(levels, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${levels.length} levels to ${OUTPUT_PATH}`);
}

main();
