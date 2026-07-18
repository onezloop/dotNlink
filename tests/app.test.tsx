import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { winModalDelayMs } from '@/utils/solvedHighlight';

const FAKE_LEVELS = [
  {
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
  },
  {
    id: 2,
    rows: 1,
    cols: 2,
    difficulty: 'easy',
    checkpoints: [
      { coord: { r: 0, c: 0 }, order: 1 },
      { coord: { r: 0, c: 1 }, order: 2 },
    ],
    walls: [],
    solution: [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ],
  },
];

vi.mock('@/data/levels.json', () => ({ default: FAKE_LEVELS }));

function stubBoardRect(): void {
  const board = screen.getByRole('grid');
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

function solveLevelOne(): void {
  const board = screen.getByRole('grid');
  stubBoardRect();
  fireEvent.pointerDown(board, { pointerId: 1, clientX: 50, clientY: 50 }); // (0,0) start
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 50, buttons: 1 }); // (0,1)
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 150, clientY: 150, buttons: 1 }); // (1,1)
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 50, clientY: 150, buttons: 1 }); // (1,0), solved
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts directly on the board for the first incomplete level — no level-select gate', async () => {
    const { App } = await import('@/App');
    render(<App />);

    expect(screen.queryByText(/select a level/i)).not.toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText(/level 1\/2/i)).toBeInTheDocument();
  });

  it('delays the win modal so the player sees the finished path first', async () => {
    vi.useFakeTimers();
    try {
      const { App } = await import('@/App');
      render(<App />);

      solveLevelOne();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Level 1 is the 2x2 FAKE_LEVELS entry — a 4-cell solved path.
      act(() => {
        vi.advanceTimersByTime(winModalDelayMs(4));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps level 2 locked until level 1 is completed, and unlocks it via the dev-only level select', async () => {
    const { App } = await import('@/App');
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /level select \(dev only\)/i }));
    expect(screen.getByRole('button', { name: /level 2 \(locked\)/i })).toBeDisabled();

    // Back to play, solve level 1.
    fireEvent.click(screen.getByRole('button', { name: /level select \(dev only\)/i }));
    solveLevelOne();

    fireEvent.click(screen.getByRole('button', { name: /level select \(dev only\)/i }));
    const level2Tile = screen.getByText('2').closest('button')!;
    expect(level2Tile).not.toBeDisabled();

    fireEvent.click(level2Tile);
    expect(screen.getByText(/level 2\/2/i)).toBeInTheDocument();
  });
});
