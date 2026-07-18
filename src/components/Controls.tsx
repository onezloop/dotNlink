interface ControlsProps {
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
}

export function Controls({ canUndo, onUndo, onRestart }: ControlsProps): JSX.Element {
  return (
    <div className="controls-row">
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button type="button" onClick={onRestart}>
        Restart
      </button>
    </div>
  );
}
