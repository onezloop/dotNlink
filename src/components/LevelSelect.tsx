import { isLevelCompleted, isLevelUnlocked } from '@/state/progress';
import type { Progress } from '@/state/progress';
import type { Level } from '@/types/level';
import { formatElapsed } from '@/utils/time';

interface LevelSelectProps {
  readonly levels: readonly Level[];
  readonly progress: Progress;
  readonly currentLevelId: number;
  readonly onSelect: (levelId: number) => void;
}

/** Player-facing level picker. Levels the player hasn't reached yet stay
 * locked so this can't be used to skip ahead; already-cleared levels can be
 * reopened to replay them and beat a previous best time. Closing the picker is
 * handled by the Back control in the fixed top bar (see App.tsx). */
export function LevelSelect({
  levels,
  progress,
  currentLevelId,
  onSelect,
}: LevelSelectProps): JSX.Element {
  return (
    <div className="level-select">
      <h1 className="level-select-title">Select a level</h1>
      <p className="level-select-hint">Replay a cleared level to beat your best time.</p>
      <div className="level-grid">
        {levels.map((level) => {
          const completed = isLevelCompleted(progress, level.id);
          const unlocked = isLevelUnlocked(progress, level.id);
          const bestTime = progress.bestTimeMs[level.id];
          const classNames = ['level-tile'];
          if (completed) classNames.push('level-tile--completed');
          if (!unlocked) classNames.push('level-tile--locked');
          if (level.id === currentLevelId) classNames.push('level-tile--current');
          return (
            <button
              key={level.id}
              type="button"
              className={classNames.join(' ')}
              disabled={!unlocked}
              aria-label={unlocked ? undefined : `Level ${level.id} (locked)`}
              aria-current={level.id === currentLevelId ? 'true' : undefined}
              onClick={() => onSelect(level.id)}
            >
              <span className="level-tile-id">{level.id}</span>
              <span className={`difficulty-badge difficulty-badge--${level.difficulty}`}>
                {level.difficulty}
              </span>
              {completed && <span className="level-tile-check">&#10003;</span>}
              {!unlocked && (
                <span className="level-tile-lock" aria-hidden="true">
                  &#128274;
                </span>
              )}
              {bestTime !== undefined && (
                <span className="level-tile-time">{formatElapsed(bestTime)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
