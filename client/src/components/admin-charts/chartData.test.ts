import { describe, expect, it } from "vitest";
import { ADMIN_ANALYTICS_HOUR_RANGE, toDonutData, toGiftedSeries, toStackedInteractionData } from "./chartData";

describe("admin chart data mapping", () => {
  it("maps bounded hourly rows into gifted chart points", () => {
    const rows = Array.from({ length: 16 }, (_, hour) => ({ hour, label: `${hour}:00`, activeUsers: hour * 2 }));

    expect(toGiftedSeries(rows, "activeUsers", { maxPoints: 4 })).toEqual([
      { value: 24, label: "12:00", hour: 12 },
      { value: 26, label: "13:00", hour: 13 },
      { value: 28, label: "14:00", hour: 14 },
      { value: 30, label: "15:00", hour: 15 }
    ]);
  });

  it("keeps the admin analytics timeline inside 06:00-22:00", () => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${String(hour).padStart(2, "0")}:00`, events: hour }));

    const series = toGiftedSeries(rows, "events", { hourRange: ADMIN_ANALYTICS_HOUR_RANGE });

    expect(series).toHaveLength(17);
    expect(series[0]).toEqual({ value: 6, label: "06:00", hour: 6 });
    expect(series.at(-1)).toEqual({ value: 22, label: "22:00", hour: 22 });
  });

  it("maps interactions into stacked bar sections", () => {
    const rows = [{ hour: 8, label: "08:00", likes: 3, saves: 2, comments: 1 }];

    expect(toStackedInteractionData(rows, { maxPoints: 1 })).toEqual([
      {
        hour: 8,
        label: "08:00",
        stacks: [
          { value: 3, color: "#2F80ED" },
          { value: 2, color: "#27AE60" },
          { value: 1, color: "#F2994A" }
        ]
      }
    ]);
  });

  it("drops zero-value donut slices and preserves colors", () => {
    expect(
      toDonutData(
        [
          { type: "likes", count: 4 },
          { type: "comments", count: 0 }
        ],
        { likes: "#2F80ED", comments: "#F2994A" }
      )
    ).toEqual([{ value: 4, text: "likes", color: "#2F80ED" }]);
  });
});
