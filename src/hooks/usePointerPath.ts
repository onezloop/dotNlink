import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { coordsEqual } from '@/engine/grid';
import type { Coord } from '@/types/level';

export interface UsePointerPathOptions {
  readonly rows: number;
  readonly cols: number;
  readonly path: readonly Coord[];
  readonly startCoord: Coord;
  readonly isIdle: boolean;
  readonly isSolved: boolean;
  readonly onBegin: () => void;
  readonly onExtendTo: (coord: Coord) => void;
  readonly onTruncateTo: (coord: Coord) => void;
  readonly onUndo: () => void;
}

export interface UsePointerPathResult {
  readonly boardRef: React.RefObject<HTMLDivElement>;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

function hitTestCell(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  rows: number,
  cols: number,
): Coord | null {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;

  const c = Math.floor((x / rect.width) * cols);
  const r = Math.floor((y / rect.height) * rows);
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return { r, c };
}

/** Interpolates one-cell-at-a-time orthogonal steps from `from` to `to`,
 * reducing whichever axis has the larger remaining delta first. Used so a
 * fast drag that skips pointermove samples still walks through every
 * intermediate cell instead of teleporting the path. */
function stepsToward(from: Coord, to: Coord): Coord[] {
  const steps: Coord[] = [];
  let current = from;
  const maxSteps = Math.abs(from.r - to.r) + Math.abs(from.c - to.c) + 1;

  while (!coordsEqual(current, to) && steps.length < maxSteps) {
    const dr = to.r - current.r;
    const dc = to.c - current.c;
    const next: Coord =
      Math.abs(dr) >= Math.abs(dc) && dr !== 0
        ? { r: current.r + Math.sign(dr), c: current.c }
        : { r: current.r, c: current.c + Math.sign(dc) };
    steps.push(next);
    current = next;
  }

  return steps;
}

const ARROW_DELTAS: Readonly<Record<string, Coord>> = {
  ArrowUp: { r: -1, c: 0 },
  ArrowDown: { r: 1, c: 0 },
  ArrowLeft: { r: 0, c: -1 },
  ArrowRight: { r: 0, c: 1 },
};

export function usePointerPath(options: UsePointerPathOptions): UsePointerPathResult {
  const boardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleHit = useCallback((coord: Coord) => {
    const { path, isIdle, isSolved, startCoord, onBegin, onExtendTo, onTruncateTo } =
      optionsRef.current;
    if (isSolved) return;

    if (isIdle) {
      // Only starting on the level's designated start cell is intended
      // behaviour — touching elsewhere on an idle board is a no-op.
      if (coordsEqual(coord, startCoord)) onBegin();
      return;
    }

    const head = path[path.length - 1];
    if (head && coordsEqual(head, coord)) return;

    const existingIndex = path.findIndex((cell) => coordsEqual(cell, coord));
    if (existingIndex !== -1) {
      onTruncateTo(coord);
      return;
    }

    if (!head) return;
    for (const step of stepsToward(head, coord)) {
      onExtendTo(step);
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cell = hitTestCell(
        event.clientX,
        event.clientY,
        rect,
        optionsRef.current.rows,
        optionsRef.current.cols,
      );
      if (!cell) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      handleHit(cell);
    },
    [handleHit],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.buttons === 0) return;
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cell = hitTestCell(
        event.clientX,
        event.clientY,
        rect,
        optionsRef.current.rows,
        optionsRef.current.cols,
      );
      if (!cell) return;
      handleHit(cell);
    },
    [handleHit],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const { path, isIdle, onUndo, onBegin } = optionsRef.current;

      if (event.key === 'Backspace') {
        event.preventDefault();
        onUndo();
        return;
      }

      const delta = ARROW_DELTAS[event.key];
      if (!delta) return;
      event.preventDefault();

      if (isIdle) {
        onBegin();
        return;
      }

      const head = path[path.length - 1];
      if (!head) return;
      handleHit({ r: head.r + delta.r, c: head.c + delta.c });
    },
    [handleHit],
  );

  return { boardRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}
