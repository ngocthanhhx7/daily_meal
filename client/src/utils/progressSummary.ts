import type { Post } from "../types/api";

export type PostingProgressSummary = {
  daysPosted: number;
  targetDays: number;
  completionRatio: number;
  streakDays: number;
  totalPosts: number;
  lastPostAt?: string;
  weekDays: Array<{
    date: Date;
    posted: boolean;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPostingProgressSummary(
  posts: Pick<Post, "_id" | "createdAt">[],
  now = new Date(),
  targetDays = 7
): PostingProgressSummary {
  const today = startOfLocalDay(now);
  const postedDayKeys = new Set(posts.map((post) => dayKey(startOfLocalDay(new Date(post.createdAt)))));
  const weekDays = Array.from({ length: targetDays }, (_, index) => {
    const date = new Date(today.getTime() - (targetDays - 1 - index) * DAY_MS);
    return {
      date,
      posted: postedDayKeys.has(dayKey(date))
    };
  });

  let streakDays = 0;
  for (let offset = 0; offset < targetDays; offset += 1) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    if (!postedDayKeys.has(dayKey(date))) {
      break;
    }
    streakDays += 1;
  }

  const daysPosted = weekDays.filter((day) => day.posted).length;
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    daysPosted,
    targetDays,
    completionRatio: targetDays > 0 ? daysPosted / targetDays : 0,
    streakDays,
    totalPosts: posts.length,
    lastPostAt: sortedPosts[0]?.createdAt,
    weekDays
  };
}
