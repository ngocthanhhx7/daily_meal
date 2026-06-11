import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import {
  COMPACT_POST_TIDY_CARD_WIDTH,
  COMPACT_POST_TIDY_GRID_MAX_WIDTH,
  CompactPostPreview
} from "../components/CompactPostPreview";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { getListContentState } from "../utils/contentState";
import { getFeedPostParams } from "../utils/postNavigation";

export function SavedScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const { token, user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const contentState = getListContentState(loading, savedPosts.length);
  const gridWidth = Math.min(width - 10, COMPACT_POST_TIDY_GRID_MAX_WIDTH);
  const cardWidth = Math.min(COMPACT_POST_TIDY_CARD_WIDTH, (gridWidth - 60) / 2);

  useEffect(() => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }

    api
      .getUserSavedPosts(token, user.id)
      .then((result) => {
        setSavedPosts(result.posts);
      })
      .catch((err) => console.error("Failed to fetch saved posts:", err))
      .finally(() => setLoading(false));
  }, [token, user?.id]);

  const leftPosts = savedPosts.filter((_, i) => i % 2 === 0);
  const rightPosts = savedPosts.filter((_, i) => i % 2 === 1);

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Đã lưu</AppText>
        <Pressable style={styles.userTab}>
          <AppText style={styles.userTabText}>Người dùng</AppText>
        </Pressable>
      </View>

      {contentState === "loading" ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : contentState === "empty" ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color={colors.muted} />
          <AppText style={styles.emptyTitle}>Chưa lưu bài viết nào</AppText>
          <AppText style={styles.emptySubtitle} muted>
            Bấm nút lưu ở các bài đăng thú vị để xem lại công thức và món ăn tại đây bất cứ lúc nào.
          </AppText>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          <View style={[styles.column, { width: cardWidth }]}>
            {leftPosts.map((item) => (
              <Pressable
                key={item._id}
                style={[styles.card, { width: cardWidth }]}
                onPress={() => navigation.navigate("Home", getFeedPostParams(item))}
              >
                <CompactPostPreview
                  post={item}
                  caption={item.caption || "Nó ngon..."}
                  captionSide="left"
                  showAuthorChip
                  tidy
                />
              </Pressable>
            ))}
          </View>
          <View style={[styles.column, styles.rightColumn, { width: cardWidth }]}>
            {rightPosts.map((item) => (
              <Pressable
                key={item._id}
                style={[styles.card, { width: cardWidth }]}
                onPress={() => navigation.navigate("Home", getFeedPostParams(item))}
              >
                <CompactPostPreview
                  post={item}
                  caption={item.caption || "Nó ngon..."}
                  captionSide="right"
                  showAuthorChip
                  tidy
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  backButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  headerTitle: {
    flex: 1
  },
  userTab: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  userTabText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.muted
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: COMPACT_POST_TIDY_GRID_MAX_WIDTH,
    alignSelf: "center",
    paddingBottom: 28
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingVertical: 120,
    gap: 14
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.muted
  }
});
