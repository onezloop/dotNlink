import { formatElapsed } from '@/utils/time';
import type { Difficulty } from '@/types/level';

interface HeaderProps {
  readonly levelId: number;
  readonly totalLevels: number;
  readonly difficulty: Difficulty;
  readonly elapsedMs: number;
}

export function Header({
  levelId,
  totalLevels,
  difficulty,
  elapsedMs,
}: HeaderProps): JSX.Element {
  return (
    <header className="app-header">
      <span className="app-title">dotNlink</span>
      <div className="app-header-meta">
        <span className="level-badge">
          Level {levelId}/{totalLevels}
        </span>
        <span className={`difficulty-badge difficulty-badge--${difficulty}`}>{difficulty}</span>
        <span className="timer" aria-live="off">
          {formatElapsed(elapsedMs)}
        </span>
      </div>
    </header>
  );
}
