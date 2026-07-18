import { wallKey } from '@/engine/grid';
import type { Wall } from '@/types/level';

interface WallsProps {
  readonly walls: readonly Wall[];
}

/** Renders each wall as a thick segment on the shared edge between its two
 * cells: a vertical line for column-adjacent pairs, horizontal for
 * row-adjacent pairs. */
export function Walls({ walls }: WallsProps): JSX.Element {
  return (
    <>
      {walls.map((wall) => {
        const { a, b } = wall;
        const key = wallKey(a, b);

        if (a.r === b.r) {
          const x = Math.min(a.c, b.c) + 1;
          return (
            <line key={key} className="wall-segment" x1={x} y1={a.r} x2={x} y2={a.r + 1} />
          );
        }

        const y = Math.min(a.r, b.r) + 1;
        return <line key={key} className="wall-segment" x1={a.c} y1={y} x2={a.c + 1} y2={y} />;
      })}
    </>
  );
}
