import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View, Dimensions } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { getListContentState } from "../utils/contentState";
import { getFeedPostParams } from "../utils/postNavigation";
import { getPostPreviewImageIndexes } from "../utils/postPreviewImages";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (Math.min(width, 480) - 48) / 2;

function authorAvatarSource(avatarUrl?: string) {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith("http") || avatarUrl.startsWith("file:") || avatarUrl.startsWith("data:")) {
    return { uri: avatarUrl };
  }
  if (avatarUrl.includes("assets/") || avatarUrl.includes("cute_")) {
    const name = avatarUrl.split("/").pop()?.replace(".png", "");
    switch (name) {
      case "cute_cat": return require("../../assets/avatar/cute_cat.png");
      case "cute_dog": return require("../../assets/avatar/cute_dog.png");
      case "cute_rabbit": return require("../../assets/avatar/cute_rabbit.png");
      case "cute_bear": return require("../../assets/avatar/cute_bear.png");
      case "cute_hamster": return require("../../assets/avatar/cute_hamster.png");
      case "cute_panda": return require("../../assets/avatar/cute_panda.png");
      case "cute_dino": return require("../../assets/avatar/cute_dino.png");
      case "cute_koala": return require("../../assets/avatar/cute_koala.png");
      case "cute_penguin": return require("../../assets/avatar/cute_penguin.png");
      case "cute_fox": return require("../../assets/avatar/cute_fox.png");
      default: break;
    }
  }
  return { uri: `${api.baseUrl}${avatarUrl}` };
}

function imageSource(post: Post, imageIndex = 0) {
  const imageUrl = post.images?.[imageIndex]?.url;
  if (!imageUrl) return require("../../assets/figma-snapshots/image3.png");
  if (imageUrl.startsWith("http")) return { uri: imageUrl };
  return { uri: `${api.baseUrl}${imageUrl}` };
}

export function SavedScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const contentState = getListContentState(loading, savedPosts.length);

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
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Đã lưu</AppText>
        <Pressable style={styles.userTab}>
          <AppText style={styles.userTabText}>Người dùng</AppText>
        </Pressable>
      </View>

      {/* Grid List */}
      {contentState === "loading" ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={contentState === "content" ? savedPosts : []}
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
          renderItem={({ item, index }) => (
            <Pressable
              style={[styles.card, index % 2 === 1 && styles.cardStaggered]}
              onPress={() => navigation.navigate("Home", getFeedPostParams(item))}
            >
              <SavedPostImageStack post={item} />

              {/* Top Tag chip */}
              <View style={[styles.tagChip, index % 2 === 0 ? { left: 10 } : { right: 10 }]}>
                <AppText numberOfLines={1} style={styles.tagChipText}>
                  {item.caption || "Nó ngon..."}
                </AppText>
              </View>

              {/* Bottom profile chip */}
              <View style={[styles.profileChip, { backgroundColor: item.author?.themeColor || colors.green }]}>
                <View style={styles.profileAvatar}>
                  {item.author?.avatarUrl ? (
                    <Image
                      source={authorAvatarSource(item.author.avatarUrl)}
                      style={styles.profileAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <AppText style={[styles.avatarText, { color: item.author?.themeColor || colors.green }]}>
                      {item.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
                    </AppText>
                  )}
                </View>
                <AppText style={styles.profileName} numberOfLines={1}>
                  {item.author?.displayName ?? "Daily Meal"}
                </AppText>
              </View>
            </Pressable>
          )}
        />
      )}
    </AppScreen>
  );
}

function SavedPostImageStack({ post }: { post: Post }) {
  const imageIndexes = getPostPreviewImageIndexes(post);

  return (
    <View style={styles.cardImageStack} pointerEvents="none">
      {imageIndexes
        .slice()
        .reverse()
        .map((imageIndex) => (
          <Image
            key={`${post._id}-${imageIndex}`}
            source={imageSource(post, imageIndex)}
            style={[
              styles.cardImageLayer,
              imageIndex === 0 && styles.cardImageFront,
              imageIndex === 1 && styles.cardImageSecond,
              imageIndex === 2 && styles.cardImageThird
            ]}
            resizeMode="cover"
          />
        ))}
    </View>
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
    paddingVertical: 6
  },
  userTabText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.muted
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
    height: COLUMN_WIDTH * 1.5,
    borderRadius: 24,
    backgroundColor: "transparent",
    overflow: "visible",
    position: "relative"
  },
  cardStaggered: {
    marginTop: 35
  },
  cardImageStack: {
    width: "100%",
    height: "100%",
    position: "relative"
  },
  cardImageLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
    backgroundColor: colors.canvasStrong
  },
  cardImageFront: {
    zIndex: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5
  },
  cardImageSecond: {
    zIndex: 2,
    top: -8,
    right: -11,
    bottom: 8,
    left: 11,
    opacity: 0.56,
    transform: [{ rotate: "4deg" }]
  },
  cardImageThird: {
    zIndex: 1,
    top: -15,
    right: -19,
    bottom: 15,
    left: 19,
    opacity: 0.34,
    transform: [{ rotate: "7deg" }]
  },
  tagChip: {
    position: "absolute",
    top: 10,
    maxWidth: "80%",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 6
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
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 6
  },
  profileAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 11
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textAlign: "center"
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
