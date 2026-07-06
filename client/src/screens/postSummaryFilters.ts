import type { PostSummaryFilter } from "../types/api";

export const POST_SUMMARY_FILTERS: Array<{ value: PostSummaryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "friends", label: "Bạn bè" },
  { value: "following", label: "Đang theo dõi" },
  { value: "strangers", label: "Người lạ" }
];

export function getPostSummaryFilterLabel(filter: PostSummaryFilter) {
  return POST_SUMMARY_FILTERS.find((item) => item.value === filter)?.label ?? "All";
}
