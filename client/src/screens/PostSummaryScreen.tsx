import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import {
  COMPACT_POST_TIDY_CARD_WIDTH,
  COMPACT_POST_TIDY_GRID_MAX_WIDTH,
  CompactPostPreview
} from "../components/CompactPostPreview";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, PostSummaryFilter } from "../types/api";
import { getFeedPostParams } from "../utils/postNavigation";
import { POST_SUMMARY_FILTERS, getPostSummaryFilterLabel } from "./postSummaryFilters";

const SUMMARY_PAGE_SIZE = 30;

export function PostSummaryScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const { token } = useAuth();
  const [filter, setFilter] = useState<PostSummaryFilter>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const gridWidth = Math.min(width - 10, COMPACT_POST_TIDY_GRID_MAX_WIDTH);
  const cardWidth = Math.min(COMPACT_POST_TIDY_CARD_WIDTH, (gridWidth - 60) / 2);
  const selectedFilterLabel = getPostSummaryFilterLabel(filter);

  const leftPosts = useMemo(() => posts.filter((_, i) => i % 2 === 0), [posts]);
  const rightPosts = useMemo(() => posts.filter((_, i) => i % 2 === 1), [posts]);

  const loadPosts = useCallback((nextFilter: PostSummaryFilter) => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    api
      .postSummary(token, nextFilter, 1, SUMMARY_PAGE_SIZE)
      .then((result) => {
        setPosts(result.posts);
        setPage(result.page);
        setHasMore(result.hasMore);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadPosts(filter);
  }, [filter, loadPosts]);

  const loadMore = useCallback(() => {
    if (!token || loadingMore || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setLoadingMore(true);
    api
      .postSummary(token, filter, nextPage, SUMMARY_PAGE_SIZE)
      .then((result) => {
        setPosts((current) => {
          const existingIds = new Set(current.map((post) => post._id));
          const newPosts = result.posts.filter((post) => !existingIds.has(post._id));
          return [...current, ...newPosts];
        });
        setPage(result.page);
        setHasMore(result.hasMore);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoadingMore(false));
  }, [filter, hasMore, loadingMore, page, token]);

  function renderPostCard(item: Post, captionSide: "left" | "right") {
    return (
      <Pressable
        key={item._id}
        style={[styles.card, { width: cardWidth }]}
        onPress={() => navigation.navigate("Home", getFeedPostParams(item))}
      >
        <CompactPostPreview
          post={item}
          caption={item.caption || "Nó ngon..."}
          captionSide={captionSide}
          showAuthorChip
          tidy
        />
      </Pressable>
    );
  }

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
        <AppText style={styles.title} numberOfLines={1}>
          Tổng hợp bài đăng
        </AppText>
      </View>

      <View style={styles.segmented}>
        {POST_SUMMARY_FILTERS.map((item) => {
          const active = item.value === filter;
          return (
            <Pressable
              key={item.value}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setFilter(item.value)}
            >
              <AppText style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : loadFailed && posts.length === 0 ? (
        <EmptyState
          title="Chưa tải được bài đăng"
          message="Không thể lấy danh sách bài đăng lúc này. Vui lòng thử lại sau."
          actionLabel="Thử lại"
          onAction={() => loadPosts(filter)}
          icon="refresh-outline"
        />
      ) : posts.length ? (
        <>
          <View style={styles.gridContainer}>
            <View style={[styles.column, { width: cardWidth }]}>
              {leftPosts.map((item) => renderPostCard(item, "left"))}
            </View>
            <View style={[styles.column, styles.rightColumn, { width: cardWidth }]}>
              {rightPosts.map((item) => renderPostCard(item, "right"))}
            </View>
          </View>
          {hasMore ? (
            <Pressable style={styles.loadMoreButton} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <AppText style={styles.loadMoreText}>Tải thêm</AppText>
              )}
            </Pressable>
          ) : null}
          {loadFailed && posts.length > 0 ? (
            <AppText style={styles.inlineError}>Chưa tải thêm được {selectedFilterLabel}. Vui lòng thử lại.</AppText>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={`Chưa có bài ${selectedFilterLabel}`}
          message="Khi có bài đăng phù hợp với bộ lọc này, Daily Meal sẽ hiển thị tại đây."
          icon="albums-outline"
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    gap: 16
  },
  header: {
    width: "100%",
    maxWidth: COMPACT_POST_TIDY_GRID_MAX_WIDTH,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  title: {
    flex: 1,
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34
  },
  segmented: {
    width: "100%",
    maxWidth: COMPACT_POST_TIDY_GRID_MAX_WIDTH,
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  segmentButtonActive: {
    backgroundColor: colors.yellow
  },
  segmentText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 12
  },
  segmentTextActive: {
    color: colors.black
  },
  stateContainer: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center"
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: COMPACT_POST_TIDY_GRID_MAX_WIDTH,
    alignSelf: "center",
    paddingBottom: 12
  },
  column: {
    flexDirection: "column",
    gap: 24
  },
  rightColumn: {
    paddingTop: 50
  },
  card: {
    borderRadius: 20,
    backgroundColor: "transparent",
    overflow: "visible",
    position: "relative"
  },
  loadMoreButton: {
    minHeight: 42,
    minWidth: 130,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.yellow
  },
  loadMoreText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14
  },
  inlineError: {
    color: colors.red,
    textAlign: "center",
    fontSize: 13
  }
});
