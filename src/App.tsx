import { useEffect, useMemo, useState } from 'react';

import { Board } from '@/components/Board';
import { Controls } from '@/components/Controls';
import { Header } from '@/components/Header';
import { LevelSelect } from '@/components/LevelSelect';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WinModal } from '@/components/WinModal';
import levelsRaw from '@/data/levels.json';
import { useGame } from '@/hooks/useGame';
import { isLevelCompleted, isLevelUnlocked, useProgress } from '@/state/progress';
import type { Progress, Theme } from '@/state/progress';
import { assertLevels } from '@/types/level';
import type { Level } from '@/types/level';
import { winModalDelayMs } from '@/utils/solvedHighlight';

const LEVELS = assertLevels(levelsRaw);

/** Resumes at the first level the player hasn't cleared yet, or the last
 * level once every level is complete. There is no other entry point into an
 * arbitrary level in production — progress is strictly sequential. */
function resolveStartingLevelId(levels: readonly Level[], progress: Progress): number {
  const firstIncomplete = levels.find((level) => !isLevelCompleted(progress, level.id));
  return firstIncomplete?.id ?? levels[levels.length - 1]!.id;
}

function useEffectiveTheme(themePreference: Theme | null): Theme {
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return themePreference ?? systemTheme;
}

export function App(): JSX.Element {
  const { progress, complete, setTheme } = useProgress();
  const [currentLevelId, setCurrentLevelId] = useState(() =>
    resolveStartingLevelId(LEVELS, progress),
  );
  const [previousBestBeforeSolve, setPreviousBestBeforeSolve] = useState<number | undefined>(
    undefined,
  );
  const [isWinModalVisible, setIsWinModalVisible] = useState(false);
  // Dev-only escape hatch for jumping between already-unlocked levels while
  // testing — the toggle button and the LevelSelect branch below are both
  // gated on import.meta.env.DEV, which `npm run build` inlines to `false`
  // and dead-code-eliminates from the production bundle.
  const [isDevLevelSelectOpen, setIsDevLevelSelectOpen] = useState(false);

  const effectiveTheme = useEffectiveTheme(progress.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const currentLevel = useMemo(
    () => LEVELS.find((level) => level.id === currentLevelId) ?? LEVELS[0]!,
    [currentLevelId],
  );

  const game = useGame(currentLevel);

  useEffect(() => {
    if (game.status === 'solved') {
      setPreviousBestBeforeSolve(progress.bestTimeMs[currentLevel.id]);
      complete(currentLevel.id, game.elapsedMs, Date.now());
      navigator.vibrate?.(50);
    }
    // Only re-run when the solved transition itself happens; re-reading
    // progress/complete here would refire this on every unrelated update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status]);

  useEffect(() => {
    if (game.status !== 'solved') {
      setIsWinModalVisible(false);
      return;
    }
    // Long enough for the path-sweep reveal (see solvedHighlight.ts) to reach
    // the last segment before the win modal covers the board.
    const timer = setTimeout(() => setIsWinModalVisible(true), winModalDelayMs(game.path.length));
    return () => clearTimeout(timer);
  }, [game.status, game.path.length]);

  function openLevel(levelId: number): void {
    if (!isLevelUnlocked(progress, levelId)) return;
    setCurrentLevelId(levelId);
    setIsDevLevelSelectOpen(false);
  }

  function goToNextLevel(): void {
    const nextId = currentLevel.id + 1;
    if (LEVELS.some((level) => level.id === nextId)) {
      openLevel(nextId);
    }
  }

  const hasNextLevel = LEVELS.some((level) => level.id === currentLevel.id + 1);

  return (
    <div className="app">
      <ThemeToggle
        theme={effectiveTheme}
        onToggle={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
      />

      {import.meta.env.DEV && (
        <button
          type="button"
          className="dev-level-select-toggle"
          onClick={() => setIsDevLevelSelectOpen((open) => !open)}
          aria-label="Level select (dev only)"
          title="Level select (dev only)"
        >
          &#9881;
        </button>
      )}

      {import.meta.env.DEV && isDevLevelSelectOpen ? (
        <LevelSelect levels={LEVELS} progress={progress} onSelect={openLevel} />
      ) : (
        <div className="play-screen">
          <Header
            levelId={currentLevel.id}
            totalLevels={LEVELS.length}
            difficulty={currentLevel.difficulty}
            elapsedMs={game.elapsedMs}
          />
          <Board
            level={currentLevel}
            path={game.path}
            status={game.status}
            orderViolationIndex={game.orderViolationIndex}
            onBegin={game.begin}
            onExtendTo={game.extendTo}
            onTruncateTo={game.truncateTo}
            onUndo={game.undo}
          />
          <Controls canUndo={game.path.length > 1} onUndo={game.undo} onRestart={game.reset} />
          {isWinModalVisible && (
            <WinModal
              levelId={currentLevel.id}
              elapsedMs={game.elapsedMs}
              previousBestMs={previousBestBeforeSolve}
              hasNextLevel={hasNextLevel}
              onNextLevel={goToNextLevel}
              onClose={() => setIsWinModalVisible(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
