type SeriesOptions = {
  maxPoints?: number;
  hourRange?: {
    start: number;
    end: number;
  };
};

type InteractionRow = {
  hour?: number;
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

export const ADMIN_ANALYTICS_HOUR_RANGE = {
  start: 6,
  end: 22
} as const;

function inHourRange(row: { hour?: unknown }, hourRange?: SeriesOptions["hourRange"]) {
  if (!hourRange) return true;
  const hour = Number(row.hour);
  return Number.isInteger(hour) && hour >= hourRange.start && hour <= hourRange.end;
}

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
  return takeTail(rows.filter((row) => inHourRange(row, options.hourRange)), options.maxPoints).map((row) => {
    const point = {
      value: Number(row[valueKey] ?? 0),
      label: String(row.label ?? row.date ?? row.hour ?? "")
    };

    return typeof row.hour === "number" ? { ...point, hour: row.hour } : point;
  });
}

export function toStackedInteractionData(rows: InteractionRow[], options: SeriesOptions = {}) {
  return takeTail(
    rows.filter((row) => inHourRange(row, options.hourRange)),
    options.maxPoints
  ).map((row) => ({
    ...(typeof row.hour === "number" ? { hour: row.hour } : {}),
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
