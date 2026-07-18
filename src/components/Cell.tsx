interface CellProps {
  readonly row: number;
  readonly col: number;
  readonly checkpointOrder: number | undefined;
  readonly isVisited: boolean;
}

export function Cell({ row, col, checkpointOrder, isVisited }: CellProps): JSX.Element {
  const label =
    checkpointOrder !== undefined
      ? `row ${row + 1} col ${col + 1}, checkpoint ${checkpointOrder}`
      : `row ${row + 1} col ${col + 1}`;

  return (
    <div
      className={`cell${isVisited ? ' cell--visited' : ''}`}
      role="gridcell"
      aria-label={label}
    />
  );
}
