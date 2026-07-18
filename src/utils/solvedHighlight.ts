/**
 * Timing for the "solved" reveal: each path segment and checkpoint plays a
 * brief pulse (see path-solved-glow / checkpoint-solved-glow in board.css),
 * staggered by PATH_SWEEP_STAGGER_MS per step along the path so the whole
 * shape lights up in sequence — start to finish — instead of every segment
 * flashing at once. PATH_SWEEP_PULSE_MS must match the CSS animation
 * duration; there's no shared source since one lives in JS and the other in
 * a keyframe declaration.
 */
export const PATH_SWEEP_STAGGER_MS = 14;
export const PATH_SWEEP_PULSE_MS = 300;

const WIN_MODAL_BUFFER_MS = 150;

/** How long App.tsx should wait after a solve before revealing the win
 * modal — long enough for the full sweep across `pathLength` cells to
 * finish, plus a short buffer, so the modal never cuts the reveal off. */
export function winModalDelayMs(pathLength: number): number {
  const segments = Math.max(0, pathLength - 1);
  return segments * PATH_SWEEP_STAGGER_MS + PATH_SWEEP_PULSE_MS + WIN_MODAL_BUFFER_MS;
}
