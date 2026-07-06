export type FeedLoadMoreGuardState = {
  now: number;
  tokenPresent: boolean;
  loading: boolean;
  hasMore: boolean;
  isDemoFeed: boolean;
  nextPage: number;
  lastRequestedPage: number;
  lastRequestAt: number;
  cooldownMs: number;
  currentIndex: number;
  lastTriggerIndex: number;
};

export function shouldStartFeedLoadMore(state: FeedLoadMoreGuardState) {
  if (!state.tokenPresent || state.loading || !state.hasMore || state.isDemoFeed) {
    return false;
  }

  if (state.nextPage <= state.lastRequestedPage) {
    return false;
  }

  if (state.now - state.lastRequestAt < state.cooldownMs) {
    return false;
  }

  return state.currentIndex > state.lastTriggerIndex;
}
