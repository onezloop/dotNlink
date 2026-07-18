import { PATH_SWEEP_STAGGER_MS } from '@/utils/solvedHighlight';
import type { Coord } from '@/types/level';

interface PathLayerProps {
  readonly path: readonly Coord[];
  /** Index in `path` where a checkpoint was hit out of order — every segment
   * from that point on renders in the error color. Null when the path is
   * (so far) entirely in sequence. */
  readonly errorFromIndex: number | null;
  /** True once the puzzle is solved — plays a one-shot pulse per segment,
   * staggered so it sweeps across the finished shape start-to-finish rather
   * than every segment flashing at once. */
  readonly isSolved: boolean;
}

/** Renders the drawn path as one `<line>` per hop rather than a single
 * polyline. Each hop keeps a stable key (its two endpoints never change once
 * drawn), so React only mounts the newest segment — its "draw in" animation
 * plays once per hop instead of replaying the whole path on every step. */
export function PathLayer({ path, errorFromIndex, isSolved }: PathLayerProps): JSX.Element | null {
  if (path.length < 2) return null;

  return (
    <>
      {path.slice(1).map((coord, i) => {
        const index = i + 1;
        const previous = path[i]!;
        const isError = errorFromIndex !== null && index >= errorFromIndex;
        const classNames = ['path-segment'];
        if (isError) classNames.push('path-segment--error');
        if (isSolved) classNames.push('path-segment--solved');
        return (
          <line
            key={`${previous.r},${previous.c}-${coord.r},${coord.c}`}
            className={classNames.join(' ')}
            style={isSolved ? { animationDelay: `${i * PATH_SWEEP_STAGGER_MS}ms` } : undefined}
            x1={previous.c + 0.5}
            y1={previous.r + 0.5}
            x2={coord.c + 0.5}
            y2={coord.r + 0.5}
            strokeWidth={0.32}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}
