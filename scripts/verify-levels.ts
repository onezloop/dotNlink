/**
 * CI / pre-commit gate: re-validates every committed level in
 * `src/data/levels.json` — solvable, uniquely solvable, checkpoints ordered
 * 1..N, and the stored `solution` actually matches a solution the solver
 * finds. Exits non-zero on any regression so a broken level never ships.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { solve } from '../src/engine/solver';
import { assertLevels } from '../src/types/level';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEVELS_PATH = path.resolve(__dirname, '../src/data/levels.json');
const NODE_LIMIT = 500_000;

function coordsEqual(a: { r: number; c: number }, b: { r: number; c: number }): boolean {
  return a.r === b.r && a.c === b.c;
}

function main(): void {
  const raw: unknown = JSON.parse(readFileSync(LEVELS_PATH, 'utf-8'));
  const levels = assertLevels(raw);

  let failures = 0;

  if (levels.length !== 100) {
    console.error(`Expected 100 levels, found ${levels.length}`);
    failures += 1;
  }

  for (const level of levels) {
    const orders = level.checkpoints.map((cp) => cp.order);
    const sorted = [...orders].sort((a, b) => a - b);
    const isSequential = sorted.every((order, index) => order === index + 1);
    if (!isSequential) {
      console.error(`Level ${level.id}: checkpoints are not ordered 1..N (got ${orders.join(',')})`);
      failures += 1;
    }

    if (level.solution.length !== level.rows * level.cols) {
      console.error(
        `Level ${level.id}: stored solution length ${level.solution.length} !== ${level.rows * level.cols} cells`,
      );
      failures += 1;
    }

    const result = solve(level, { countLimit: 2, nodeLimit: NODE_LIMIT });

    if (result.truncated) {
      console.error(`Level ${level.id}: solver truncated before establishing uniqueness`);
      failures += 1;
      continue;
    }

    if (result.count === 0) {
      console.error(`Level ${level.id}: reports NO solution`);
      failures += 1;
      continue;
    }

    if (result.count > 1) {
      console.error(`Level ${level.id}: reports ${result.count} solutions, expected exactly 1`);
      failures += 1;
      continue;
    }

    const found = result.solution;
    const matchesStored =
      found !== null &&
      found.length === level.solution.length &&
      found.every((coord, index) => coordsEqual(coord, level.solution[index]!));
    if (!matchesStored) {
      console.error(`Level ${level.id}: solver's unique solution doesn't match stored solution`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} verification failure(s) across ${levels.length} levels.`);
    process.exit(1);
  }

  console.log(`All ${levels.length} levels verified: solvable, unique, and ordered correctly.`);
}

main();
