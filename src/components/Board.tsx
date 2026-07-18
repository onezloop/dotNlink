import { useLayoutEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { coordsEqual, toIndex } from '@/engine/grid';
import { pathToIndexSet } from '@/engine/validation';
import { usePointerPath } from '@/hooks/usePointerPath';
import type { GameStatus } from '@/hooks/useGame';
import { pathHueForLevel } from '@/utils/pathColor';
import { PATH_SWEEP_STAGGER_MS } from '@/utils/solvedHighlight';
import type { Coord, Level } from '@/types/level';

import { Cell } from './Cell';
import { PathLayer } from './PathLayer';
import { Walls } from './Walls';

const MIN_CHECKPOINT_PX = 16;
const MAX_CHECKPOINT_PX = 42;
const CHECKPOINT_TO_CELL_RATIO = 0.7;

type BoardWrapperStyle = CSSProperties & { '--path-hue'?: number };

interface BoardProps {
  readonly level: Level;
  readonly path: readonly Coord[];
  readonly status: GameStatus;
  readonly orderViolationIndex: number | null;
  readonly onBegin: () => void;
  readonly onExtendTo: (coord: Coord) => void;
  readonly onTruncateTo: (coord: Coord) => void;
  readonly onUndo: () => void;
}

export function Board({
  level,
  path,
  status,
  orderViolationIndex,
  onBegin,
  onExtendTo,
  onTruncateTo,
  onUndo,
}: BoardProps): JSX.Element {
  const startCoord =
    level.checkpoints.find((cp) => cp.order === 1)?.coord ?? { r: 0, c: 0 };

  const { boardRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = usePointerPath({
    rows: level.rows,
    cols: level.cols,
    path,
    startCoord,
    isIdle: status === 'idle',
    isSolved: status === 'solved',
    onBegin,
    onExtendTo,
    onTruncateTo,
    onUndo,
  });

  // Checkpoint circles are sized in real pixels, not a percentage of the
  // board, so they shrink along with the cells as the grid grows — a fixed
  // percentage overflows into neighbouring cells once a level has more than
  // a handful of columns.
  //
  // useLayoutEffect (not useEffect) so the real width is measured and applied
  // synchronously before the browser paints — ResizeObserver's own callback
  // fires asynchronously on its own cycle, which left a visible flash of the
  // CSS fallback size right after the board first mounted.
  const [boardWidthPx, setBoardWidthPx] = useState(0);
  useLayoutEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    setBoardWidthPx(node.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setBoardWidthPx(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [boardRef]);

  const cellPx = boardWidthPx / level.cols;
  const checkpointPx = cellPx
    ? Math.min(MAX_CHECKPOINT_PX, Math.max(MIN_CHECKPOINT_PX, cellPx * CHECKPOINT_TO_CELL_RATIO))
    : undefined;

  const pathHue = useMemo(() => pathHueForLevel(level.id), [level.id]);
  const boardWrapperStyle: BoardWrapperStyle = {
    aspectRatio: `${level.cols} / ${level.rows}`,
    '--path-hue': pathHue,
  };

  const isSolved = status === 'solved';
  const violationCoord = orderViolationIndex !== null ? path[orderViolationIndex] : undefined;
  const visited = pathToIndexSet(path, level.cols);
  const cells: JSX.Element[] = [];
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      const checkpoint = level.checkpoints.find((cp) => cp.coord.r === r && cp.coord.c === c);
      cells.push(
        <Cell
          key={toIndex({ r, c }, level.cols)}
          row={r}
          col={c}
          checkpointOrder={checkpoint?.order}
          isVisited={visited.has(toIndex({ r, c }, level.cols))}
        />,
      );
    }
  }

  return (
    <div className="board-wrapper" style={boardWrapperStyle}>
      <div
        ref={boardRef}
        className="board"
        role="grid"
        aria-label={`dotNlink puzzle board, ${level.rows} by ${level.cols}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div
          className="board-grid"
          style={{
            gridTemplateRows: `repeat(${level.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${level.cols}, 1fr)`,
          }}
        >
          {cells}
        </div>

        <svg
          className="board-overlay"
          viewBox={`0 0 ${level.cols} ${level.rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <Walls walls={level.walls} />
          <PathLayer path={path} errorFromIndex={orderViolationIndex} isSolved={isSolved} />
        </svg>

        <div className="board-checkpoints" aria-hidden="true">
          {level.checkpoints.map((checkpoint) => {
            const isWrongTurn =
              violationCoord !== undefined && coordsEqual(checkpoint.coord, violationCoord);
            const isDoubleDigit = checkpoint.order >= 10;
            const classNames = ['checkpoint'];
            if (isWrongTurn) classNames.push('checkpoint--error');
            if (isSolved) classNames.push('checkpoint--solved');
            // Delay this checkpoint's pulse until the path sweep reaches its
            // cell, so checkpoints light up in solve order as part of the
            // same start-to-finish sweep instead of blinking together.
            const sweepIndex = isSolved
              ? path.findIndex((coord) => coordsEqual(coord, checkpoint.coord))
              : -1;
            return (
              <div
                key={checkpoint.order}
                className={classNames.join(' ')}
                style={{
                  left: `${((checkpoint.coord.c + 0.5) / level.cols) * 100}%`,
                  top: `${((checkpoint.coord.r + 0.5) / level.rows) * 100}%`,
                  width: checkpointPx ? `${checkpointPx}px` : undefined,
                  height: checkpointPx ? `${checkpointPx}px` : undefined,
                  fontSize: checkpointPx
                    ? `${checkpointPx * (isDoubleDigit ? 0.34 : 0.44)}px`
                    : undefined,
                  animationDelay:
                    sweepIndex >= 0 ? `${sweepIndex * PATH_SWEEP_STAGGER_MS}ms` : undefined,
                }}
              >
                {checkpoint.order}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
