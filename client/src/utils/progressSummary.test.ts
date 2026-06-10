import { describe, expect, it } from "vitest";
import { getPostingProgressSummary } from "./progressSummary";
import type { Post, User } from "../types/api";

const author = {
  id: "user-1",
  displayName: "User",
  isPremium: false,
  preferences: {
    interests: [],
    eatingStyles: [],
    completedOnboarding: true
  }
} as User;

function post(id: string, createdAt: string): Post {
  return {
    _id: id,
    author,
    caption: id,
    images: [],
    tags: [],
    visibility: "public",
    stats: { likes: 0, comments: 0, saves: 0 },
    createdAt,
    updatedAt: createdAt
  } as Post;
}

describe("getPostingProgressSummary", () => {
  it("counts unique posting days in the last seven days and current streak", () => {
    const summary = getPostingProgressSummary(
      [
        post("today-a", "2026-06-10T08:00:00"),
        post("today-b", "2026-06-10T12:00:00"),
        post("yesterday", "2026-06-09T12:00:00"),
        post("two-days", "2026-06-08T12:00:00"),
        post("old", "2026-06-01T12:00:00")
      ],
      new Date("2026-06-10T18:00:00")
    );

    expect(summary.daysPosted).toBe(3);
    expect(summary.targetDays).toBe(7);
    expect(summary.completionRatio).toBeCloseTo(3 / 7);
    expect(summary.streakDays).toBe(3);
  });

  it("does not count a streak when today has no post", () => {
    const summary = getPostingProgressSummary(
      [post("yesterday", "2026-06-09T12:00:00")],
      new Date("2026-06-10T18:00:00")
    );

    expect(summary.daysPosted).toBe(1);
    expect(summary.streakDays).toBe(0);
  });
});
