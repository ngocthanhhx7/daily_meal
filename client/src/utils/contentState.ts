export type ListContentState = "loading" | "content" | "empty";

export function getListContentState(loading: boolean, itemCount: number): ListContentState {
  if (loading) {
    return "loading";
  }

  return itemCount > 0 ? "content" : "empty";
}
