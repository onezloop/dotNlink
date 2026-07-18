import { isLevelCompleted, isLevelUnlocked } from '@/state/progress';
import type { Progress } from '@/state/progress';
import type { Level } from '@/types/level';
import { formatElapsed } from '@/utils/time';

interface LevelSelectProps {
  readonly levels: readonly Level[];
  readonly progress: Progress;
  readonly onSelect: (levelId: number) => void;
}

/** Dev-only level browser (see the dev-icon gate in App.tsx) — even here,
 * levels the player hasn't reached yet stay locked so this never becomes a
 * way to skip ahead; it's for jumping back to already-unlocked levels. */
export function LevelSelect({ levels, progress, onSelect }: LevelSelectProps): JSX.Element {
  return (
    <div className="level-select">
      <h1>dotNlink &mdash; select a level</h1>
      <div className="level-grid">
        {levels.map((level) => {
          const completed = isLevelCompleted(progress, level.id);
          const unlocked = isLevelUnlocked(progress, level.id);
          const bestTime = progress.bestTimeMs[level.id];
          const classNames = ['level-tile'];
          if (completed) classNames.push('level-tile--completed');
          if (!unlocked) classNames.push('level-tile--locked');
          return (
            <button
              key={level.id}
              type="button"
              className={classNames.join(' ')}
              disabled={!unlocked}
              aria-label={unlocked ? undefined : `Level ${level.id} (locked)`}
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
