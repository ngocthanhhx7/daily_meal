import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import {
  COMPACT_POST_CARD_WIDTH,
  COMPACT_POST_GRID_MAX_WIDTH,
  CompactPostPreview
} from "../components/CompactPostPreview";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { getFeedPostParams } from "../utils/postNavigation";

export function ProgressScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const gridWidth = Math.min(width - 40, COMPACT_POST_GRID_MAX_WIDTH);
  const cardWidth = Math.min(COMPACT_POST_CARD_WIDTH, (gridWidth - 18) / 2);

  const loadPosts = useCallback(() => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    api
      .getUserPosts(token, user.id)
      .then((result) => setPosts(result.posts))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [token, user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const totals = useMemo(
    () =>
      posts.reduce(
        (sum, post) => ({
          comments: sum.comments + (post.stats?.comments ?? 0),
          likes: sum.likes + (post.stats?.likes ?? 0)
        }),
        { comments: 0, likes: 0 }
      ),
    [posts]
  );

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
        <AppText style={styles.title} numberOfLines={1}>
          Theo dõi tiến độ
        </AppText>
      </View>

      <View style={styles.totalBlock}>
        <AppText style={styles.totalLabel}>Tổng</AppText>
        <View style={styles.totalChip}>
          <View style={styles.totalItem}>
            <Ionicons name="chatbubble-outline" size={19} color={colors.black} />
            <AppText style={styles.totalValue}>{totals.comments}</AppText>
          </View>
          <View style={styles.totalItem}>
            <Ionicons name="heart" size={20} color={colors.red} />
            <AppText style={styles.totalValue}>{totals.likes}</AppText>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : loadFailed ? (
        <EmptyState
          title="Chưa tải được tiến độ"
          message="Không thể lấy danh sách bài đăng lúc này. Vui lòng thử lại sau."
          actionLabel="Thử lại"
          onAction={loadPosts}
          icon="refresh-outline"
        />
      ) : posts.length ? (
        <View style={[styles.grid, { maxWidth: COMPACT_POST_GRID_MAX_WIDTH }]}>
          {posts.map((post, index) => (
            <Pressable
              key={post._id}
              style={[styles.gridItem, { width: cardWidth }, index % 2 === 1 && styles.gridItemLower]}
              onPress={() => navigation.navigate("Home", getFeedPostParams(post))}
            >
              <CompactPostPreview
                post={post}
                captionSide={index % 2 === 0 ? "left" : "right"}
                showAuthorChip={index % 3 === 0}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Chưa có tiến độ"
          message="Đăng bài đầu tiên để Daily Meal bắt đầu theo dõi tương tác của bạn."
          actionLabel="Đăng ảnh"
          onAction={() => navigation.navigate("Create")}
          icon="bar-chart-outline"
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
    maxWidth: COMPACT_POST_GRID_MAX_WIDTH,
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
  totalBlock: {
    width: "100%",
    maxWidth: COMPACT_POST_GRID_MAX_WIDTH,
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    marginBottom: -2
  },
  totalLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 14
  },
  totalChip: {
    minWidth: 110,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4
  },
  totalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  totalValue: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16
  },
  stateContainer: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center"
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignSelf: "center",
    rowGap: 28,
    paddingTop: 2,
    paddingBottom: 28
  },
  gridItem: {
    borderRadius: 20,
    overflow: "visible"
  },
  gridItemLower: {
    marginTop: 66
  }
});
