import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, View, Dimensions } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (Math.min(width, 480) - 48) / 2;

function imageSource(post: Post) {
  const first = post.images?.[0]?.url;
  if (!first) return require("../../assets/figma-snapshots/image3.png");
  if (first.startsWith("http")) return { uri: first };
  return { uri: `${api.baseUrl}${first}` };
}

export function SavedScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.id) return;

    api
      .getUserSavedPosts(token, user.id)
      .then((result) => {
        setSavedPosts(result.posts);
      })
      .catch((err) => console.error("❌ Failed to fetch saved posts:", err))
      .finally(() => setLoading(false));
  }, [token, user?.id]);

  return (
    <AppScreen scroll={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Đã lưu</AppText>
        <Pressable style={styles.userTab}>
          <AppText style={styles.userTabText}>Bài viết</AppText>
        </Pressable>
      </View>

      {/* Grid List */}
      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={colors.muted} />
            <AppText style={styles.emptyTitle}>Chưa lưu bài viết nào</AppText>
            <AppText style={styles.emptySubtitle} muted>
              Bấm nút lưu ở các bài đăng thú vị để xem lại công thức và món ăn tại đây bất cứ lúc nào!
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("Comments", { post: item })}
          >
            <Image source={imageSource(item)} style={styles.cardImage} resizeMode="cover" />
            
            {/* Top Tag chip */}
            <View style={styles.tagChip}>
              <AppText numberOfLines={1} style={styles.tagChipText}>
                {item.caption || "Nó ngon..."}
              </AppText>
            </View>

            {/* Bottom profile chip */}
            <View style={styles.profileChip}>
              <View style={styles.profileAvatar}>
                <AppText style={styles.avatarText}>
                  {item.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
                </AppText>
              </View>
              <AppText style={styles.profileName} numberOfLines={1}>
                {item.author?.displayName ?? "Daily Meal"}
              </AppText>
            </View>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1
  },
  userTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${colors.green}15`,
    borderRadius: 14
  },
  userTabText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.greenDark
  },
  listContainer: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 24
  },
  columnWrapper: {
    justifyContent: "space-between"
  },
  card: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.35,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    position: "relative"
  },
  cardImage: {
    width: "100%",
    height: "100%"
  },
  tagChip: {
    position: "absolute",
    top: 10,
    left: 10,
    maxWidth: "80%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  tagChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.black
  },
  profileChip: {
    position: "absolute",
    bottom: 10,
    left: 10,
    maxWidth: "85%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${colors.green}90`,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  profileAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.green
  },
  profileName: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 11
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
