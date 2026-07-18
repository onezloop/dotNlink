import { formatElapsed } from '@/utils/time';

interface WinModalProps {
  readonly levelId: number;
  readonly elapsedMs: number;
  readonly previousBestMs: number | undefined;
  readonly hasNextLevel: boolean;
  readonly onNextLevel: () => void;
  readonly onClose: () => void;
}

export function WinModal({
  levelId,
  elapsedMs,
  previousBestMs,
  hasNextLevel,
  onNextLevel,
  onClose,
}: WinModalProps): JSX.Element {
  // On a first solve there's no prior record, so this run *is* the best time.
  // On a replay it's whichever run was faster.
  const bestMs = previousBestMs === undefined ? elapsedMs : Math.min(previousBestMs, elapsedMs);
  const beatRecord = previousBestMs !== undefined && elapsedMs < previousBestMs;

  return (
    <div className="win-modal-backdrop" role="dialog" aria-modal="true" aria-label="Level solved">
      <div className="win-modal">
        <div className="win-modal-confetti" aria-hidden="true" />
        <h2>Solved!</h2>
        <p className="win-modal-time">{formatElapsed(elapsedMs)}</p>
        {beatRecord && <p className="win-modal-best">New best time!</p>}
        <p className="win-modal-best">
          Level {levelId} best time: {formatElapsed(bestMs)}
        </p>
        {!hasNextLevel && <p className="win-modal-best">You&rsquo;ve cleared every level!</p>}
        <div className="win-modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {hasNextLevel && (
            <button type="button" className="win-modal-next" onClick={onNextLevel}>
              Next level
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
