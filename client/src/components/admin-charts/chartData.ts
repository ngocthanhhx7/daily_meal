type SeriesOptions = {
  maxPoints?: number;
};

type InteractionRow = {
  label: string;
  likes?: number;
  saves?: number;
  comments?: number;
};

type DonutInput = {
  type: string;
  count: number;
};

export const interactionColors = {
  likes: "#2F80ED",
  saves: "#27AE60",
  comments: "#F2994A"
};

function takeTail<T>(rows: T[], maxPoints?: number) {
  if (!maxPoints || rows.length <= maxPoints) {
    return rows;
  }

  return rows.slice(-maxPoints);
}

export function toGiftedSeries<T extends Record<string, unknown>>(
  rows: T[],
  valueKey: keyof T,
  options: SeriesOptions = {}
) {
  return takeTail(rows, options.maxPoints).map((row) => ({
    value: Number(row[valueKey] ?? 0),
    label: String(row.label ?? row.date ?? row.hour ?? "")
  }));
}

export function toStackedInteractionData(rows: InteractionRow[], options: SeriesOptions = {}) {
  return takeTail(rows, options.maxPoints).map((row) => ({
    label: row.label,
    stacks: [
      { value: Number(row.likes ?? 0), color: interactionColors.likes },
      { value: Number(row.saves ?? 0), color: interactionColors.saves },
      { value: Number(row.comments ?? 0), color: interactionColors.comments }
    ]
  }));
}

export function toDonutData(rows: DonutInput[], colorByType: Record<string, string>) {
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      value: row.count,
      text: row.type,
      color: colorByType[row.type] ?? "#8BA58A"
    }));
}
