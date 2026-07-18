import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Board } from '@/components/Board';
import { useGame } from '@/hooks/useGame';
import type { Level } from '@/types/level';

const LEVEL: Level = {
  id: 1,
  rows: 2,
  cols: 2,
  difficulty: 'easy',
  checkpoints: [
    { coord: { r: 0, c: 0 }, order: 1 },
    { coord: { r: 1, c: 0 }, order: 2 },
  ],
  walls: [],
  solution: [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 1, c: 1 },
    { r: 1, c: 0 },
  ],
};

function Harness({ level = LEVEL }: { level?: Level } = {}): JSX.Element {
  const game = useGame(level);
  return (
    <div>
      <Board
        level={level}
        path={game.path}
        status={game.status}
        orderViolationIndex={game.orderViolationIndex}
        onBegin={game.begin}
        onExtendTo={game.extendTo}
        onTruncateTo={game.truncateTo}
        onUndo={game.undo}
      />
      <output data-testid="status">{game.status}</output>
      <output data-testid="path-length">{game.path.length}</output>
      <output data-testid="violation-index">{String(game.orderViolationIndex)}</output>
    </div>
  );
}

/** A 200x200 board over a 2x2 grid puts cell centers at 50/150 in each axis. */
function stubBoardRect(board: HTMLElement): void {
  board.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
    right: 200,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
}

describe('Board interaction', () => {
  it('drawing the full correct path triggers solved', () => {
    render(<Harness />);
    const board = screen.getByRole('grid');
    stubBoardRect(board);

    fireEvent.pointerDown(board, { pointerId: 1, clientX: 50, clientY: 50 }); // (0,0) start
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 50, buttons: 1 }); // (0,1)
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 150, buttons: 1 }); // (1,1)
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 50, clientY: 150, buttons: 1 }); // (1,0)

    expect(screen.getByTestId('status')).toHaveTextContent('solved');
    expect(screen.getByTestId('path-length')).toHaveTextContent('4');
  });

  it('dragging back onto an earlier cell truncates (erases) the path', () => {
    render(<Harness />);
    const board = screen.getByRole('grid');
    stubBoardRect(board);

    fireEvent.pointerDown(board, { pointerId: 1, clientX: 50, clientY: 50 }); // (0,0) start
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 50, buttons: 1 }); // (0,1)
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 150, buttons: 1 }); // (1,1)
    expect(screen.getByTestId('path-length')).toHaveTextContent('3');

    // Drag back onto the start cell — truncates to just that one cell.
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 50, clientY: 50, buttons: 1 });

    expect(screen.getByTestId('path-length')).toHaveTextContent('1');
    expect(screen.getByTestId('status')).toHaveTextContent('playing');
  });

  it('allows stepping onto an out-of-order checkpoint and flags it instead of blocking it', () => {
    // A straight 1x5 row where checkpoint 3 physically sits between 1 and 2,
    // so walking toward checkpoint 2 passes through checkpoint 3 first.
    const level: Level = {
      id: 2,
      rows: 1,
      cols: 5,
      difficulty: 'easy',
      checkpoints: [
        { coord: { r: 0, c: 0 }, order: 1 },
        { coord: { r: 0, c: 4 }, order: 2 },
        { coord: { r: 0, c: 2 }, order: 3 },
      ],
      walls: [],
      solution: [],
    };

    render(<Harness level={level} />);
    const board = screen.getByRole('grid');
    // A 500x100 board over a 5x1 grid puts cell centers at 50,150,250,350,450.
    board.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 500,
      height: 100,
      right: 500,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    fireEvent.pointerDown(board, { pointerId: 1, clientX: 50, clientY: 50 }); // (0,0) start
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 50, buttons: 1 }); // (0,1)
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 250, clientY: 50, buttons: 1 }); // (0,2) = checkpoint 3, out of order

    // The move is allowed — path extends — but flagged as a mistake rather
    // than silently refused.
    expect(screen.getByTestId('path-length')).toHaveTextContent('3');
    expect(screen.getByTestId('violation-index')).toHaveTextContent('2');
    expect(screen.getByTestId('status')).toHaveTextContent('playing');

    const wrongCheckpoint = within(board).getByText('3');
    expect(wrongCheckpoint).toHaveClass('checkpoint--error');

    // Backtracking past the mistake clears the flag.
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 50, buttons: 1 });
    expect(screen.getByTestId('violation-index')).toHaveTextContent('null');
    expect(wrongCheckpoint).not.toHaveClass('checkpoint--error');
  });
});
