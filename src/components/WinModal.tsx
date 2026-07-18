import { formatElapsed } from '@/utils/time';

interface WinModalProps {
  readonly elapsedMs: number;
  readonly previousBestMs: number | undefined;
  readonly hasNextLevel: boolean;
  readonly onNextLevel: () => void;
  readonly onClose: () => void;
}

export function WinModal({
  elapsedMs,
  previousBestMs,
  hasNextLevel,
  onNextLevel,
  onClose,
}: WinModalProps): JSX.Element {
  const isNewBest = previousBestMs === undefined || elapsedMs < previousBestMs;

  return (
    <div className="win-modal-backdrop" role="dialog" aria-modal="true" aria-label="Level solved">
      <div className="win-modal">
        <div className="win-modal-confetti" aria-hidden="true" />
        <h2>Solved!</h2>
        <p className="win-modal-time">{formatElapsed(elapsedMs)}</p>
        {isNewBest ? (
          <p className="win-modal-best">New best time!</p>
        ) : (
          <p className="win-modal-best">Best: {formatElapsed(previousBestMs)}</p>
        )}
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
