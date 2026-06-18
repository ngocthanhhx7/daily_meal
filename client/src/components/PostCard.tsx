import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { AppText } from "./AppText";
import { NutritionCard } from "./NutritionCard";
import { PostVideoPlayer } from "./PostVideoPlayer";
import { StickerBadge } from "./StickerBadge";
import { TrackedImage } from "./TrackedImage";

type PostCardProps = {
  post: Post;
  token?: string | null;
  onAuthorPress?: () => void;
  onCommentPress?: () => void;
  onRecipePress?: () => void;
  onEditPress?: () => void;
};

function imageSource(post: Post) {
  const first = post.images[0]?.url;
  if (!first) {
    return require("../../assets/figma-snapshots/image3.png");
  }
  if (first.startsWith("http")) {
    return { uri: first };
  }
  return { uri: `${api.baseUrl}${first}` };
}

function videoSource(post: Post) {
  const url = post.video?.url;
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:")) {
    return url;
  }
  return `${api.baseUrl}${url}`;
}

export function PostCard({
  post,
  token,
  onAuthorPress,
  onCommentPress,
  onRecipePress,
  onEditPress
}: PostCardProps) {
  const [stats, setStats] = React.useState(post.stats);

  async function toggleLike() {
    if (!token) return;
    const result = await api.likePost(token, post._id);
    setStats(result.stats);
  }

  async function toggleSave() {
    if (!token) return;
    const result = await api.savePost(token, post._id);
    setStats(result.stats);
  }

  return (
    <View style={styles.card}>
      {/* Author row */}
      <Pressable style={styles.authorRow} onPress={onAuthorPress}>
        <View style={styles.avatar}>
          <AppText variant="caption" style={styles.avatarText}>
            {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
          </AppText>
        </View>
        <View style={styles.authorText}>
          {/* numberOfLines=1 ngăn tên dài vỡ layout */}
          <AppText variant="button" numberOfLines={1}>
            {post.author?.displayName ?? "Daily Meal"}
          </AppText>
          <AppText variant="caption" muted>
            {post.author?.isPremium ? "Premium creator" : "Food journal"}
          </AppText>
        </View>
        {onEditPress ? (
          <Pressable onPress={onEditPress} style={styles.iconButton} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>

      {post.mediaType === "video" && videoSource(post) ? (
        <PostVideoPlayer uri={videoSource(post)!} active style={styles.image} />
      ) : (
        <TrackedImage
          metricName="post_card_image"
          source={imageSource(post)}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Body */}
      <View style={styles.body}>
        <StickerBadge sticker={post.stickerId} />
        <AppText numberOfLines={3}>
          {post.caption || "Một bữa ăn đáng nhớ trong ngày."}
        </AppText>
        {post.tags.length ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {post.tags.map((tag) => `#${tag}`).join("  ")}
          </AppText>
        ) : null}
        <NutritionCard nutrition={post.nutritionSummary} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={toggleLike} hitSlop={4}>
          <Ionicons name="heart" size={18} color={colors.red} />
          <AppText variant="caption">{stats.likes}</AppText>
        </Pressable>
        <Pressable style={styles.action} onPress={onCommentPress} hitSlop={4}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
          <AppText variant="caption">{stats.comments}</AppText>
        </Pressable>
        <Pressable style={styles.action} onPress={toggleSave} hitSlop={4}>
          <Ionicons name="bookmark-outline" size={17} color={colors.muted} />
          <AppText variant="caption">{stats.saves}</AppText>
        </Pressable>
        <Pressable style={styles.recipe} onPress={onRecipePress}>
          <Ionicons name="restaurant-outline" size={15} color={colors.green} />
          <AppText variant="caption" style={styles.recipeLabel}>
            Công thức
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden"
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    // Không bao giờ bị co lại
    flexShrink: 0
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.semibold
  },
  authorText: {
    // flex:1 + minWidth:0 = ngăn text tràn ra ngoài
    flex: 1,
    minWidth: 0
  },
  iconButton: {
    padding: 6,
    flexShrink: 0
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.canvasStrong
  },
  body: {
    padding: 14,
    gap: 10
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  recipe: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  recipeLabel: {
    color: colors.green
  }
});
