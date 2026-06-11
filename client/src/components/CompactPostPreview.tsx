import React from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { AppText } from "./AppText";

export const COMPACT_POST_GRID_MAX_WIDTH = 335;
export const COMPACT_POST_CARD_WIDTH = 154;
export const COMPACT_POST_ASPECT_RATIO = 154 / 236;
export const COMPACT_POST_TIDY_GRID_MAX_WIDTH = 304;
export const COMPACT_POST_TIDY_CARD_WIDTH = 136;
export const COMPACT_POST_TIDY_ASPECT_RATIO = 136 / 176;

type CompactPostPreviewProps = {
  post: Post;
  caption?: string;
  captionSide?: "left" | "right";
  showAuthorChip?: boolean;
  tidy?: boolean;
  style?: StyleProp<ViewStyle>;
};

function postImageSource(post: Post, imageIndex = 0): ImageSourcePropType {
  const imageUrl = post.images?.[imageIndex]?.url;
  if (!imageUrl) {
    return require("../../assets/figma-snapshots/image3.png");
  }
  if (
    imageUrl.startsWith("http") ||
    imageUrl.startsWith("file:") ||
    imageUrl.startsWith("data:") ||
    imageUrl.startsWith("blob:")
  ) {
    return { uri: imageUrl };
  }
  return { uri: `${api.baseUrl}${imageUrl}` };
}

function avatarSource(avatarUrl?: string): ImageSourcePropType | undefined {
  if (!avatarUrl) {
    return undefined;
  }
  if (
    avatarUrl.startsWith("http") ||
    avatarUrl.startsWith("file:") ||
    avatarUrl.startsWith("data:") ||
    avatarUrl.startsWith("blob:")
  ) {
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

function previewIndexes(post: Post) {
  const imageCount = post.images?.length ?? 0;
  const previewCount = Math.min(Math.max(imageCount, 1), 3);
  return Array.from({ length: previewCount }, (_, index) => index);
}

export function CompactPostPreview({
  post,
  caption,
  captionSide = "left",
  showAuthorChip = false,
  tidy = false,
  style
}: CompactPostPreviewProps) {
  const label = caption ?? post.caption ?? post.recipe?.title ?? "Bữa ăn";
  const authorName = post.author?.displayName ?? "Daily Meal";
  const avatar = avatarSource(post.author?.avatarUrl);
  const imageIndexes = tidy ? [0] : previewIndexes(post);

  return (
    <View style={[styles.preview, tidy && styles.previewTidy, style]}>
      <View style={styles.imageStack} pointerEvents="none">
        {imageIndexes
          .slice()
          .reverse()
          .map((imageIndex) => (
            <Image
              key={`${post._id}-${imageIndex}`}
              source={postImageSource(post, imageIndex)}
              style={[
                styles.imageLayer,
                tidy && styles.imageLayerTidy,
                imageIndex === 0 && styles.imageFront,
                !tidy && imageIndex === 1 && styles.imageSecond,
                !tidy && imageIndex === 2 && styles.imageThird
              ]}
              resizeMode="cover"
            />
          ))}
      </View>

      <View style={[styles.captionChip, captionSide === "left" ? styles.leftChip : styles.rightChip]}>
        <AppText variant="caption" numberOfLines={1} style={styles.captionText}>
          {label}
        </AppText>
      </View>

      {showAuthorChip ? (
        <View style={[styles.authorChip, { backgroundColor: post.author?.themeColor || colors.green }]}>
          <View style={styles.authorAvatar}>
            {avatar ? (
              <Image source={avatar} style={styles.authorAvatarImage} resizeMode="cover" />
            ) : (
              <AppText style={[styles.avatarText, { color: post.author?.themeColor || colors.green }]}>
                {authorName.slice(0, 1).toUpperCase()}
              </AppText>
            )}
          </View>
          <AppText numberOfLines={1} style={styles.authorName}>
            {authorName}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: "100%",
    aspectRatio: COMPACT_POST_ASPECT_RATIO,
    borderRadius: 20,
    overflow: "visible",
    position: "relative"
  },
  previewTidy: {
    aspectRatio: COMPACT_POST_TIDY_ASPECT_RATIO,
    borderRadius: 16,
    overflow: "hidden"
  },
  imageStack: {
    ...StyleSheet.absoluteFillObject
  },
  imageLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 20,
    backgroundColor: colors.canvasStrong
  },
  imageLayerTidy: {
    borderRadius: 16
  },
  imageFront: {
    zIndex: 3,
    shadowColor: colors.black,
    shadowOffset: { width: -1, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5
  },
  imageSecond: {
    zIndex: 2,
    top: -7,
    right: -9,
    bottom: 7,
    left: 9,
    opacity: 0.58,
    transform: [{ rotate: "4deg" }]
  },
  imageThird: {
    zIndex: 1,
    top: -13,
    right: -15,
    bottom: 13,
    left: 15,
    opacity: 0.34,
    transform: [{ rotate: "7deg" }]
  },
  captionChip: {
    position: "absolute",
    top: 10,
    maxWidth: "82%",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: colors.black,
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 6
  },
  leftChip: {
    left: 8
  },
  rightChip: {
    right: 8
  },
  captionText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 10
  },
  authorChip: {
    position: "absolute",
    bottom: 8,
    left: 8,
    maxWidth: "86%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 13,
    paddingLeft: 3,
    paddingRight: 9,
    paddingVertical: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 7
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  authorAvatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12
  },
  authorName: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 10,
    maxWidth: 94
  }
});
