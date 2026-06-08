import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "../components/AppText";
import { FigmaLineBackground } from "../components/AppScreen";
import { StaggerItem, Wiggle, FadeSlideIn } from "../components/Animations";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api/client";
import { authorAvatarSource } from "./HomeScreen";
import { stickerImageSource } from "../utils/stickers";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { ImageRecipe, Post } from "../types/api";

const DEMO_STICKER = require("../../assets/feed/home-sticker.png");
const DEMO_AUTHOR_AVATAR = require("../../assets/feed/home-author.png");
const DEMO_IMAGES = [
  require("../../assets/feed/home-food-back.png"),
  require("../../assets/feed/home-food-mid.png"),
  require("../../assets/feed/home-food-main.png")
];

function recipeImageSource(post: Post, index: number) {
  const url = post.images[index]?.url ?? post.images[0]?.url;
  if (!url) return DEMO_IMAGES[index % DEMO_IMAGES.length];
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${api.baseUrl}${url}` };
}

/**
 * Build a unified list of recipes.
 * - If post.recipes[] exists and has items, use those
 * - Else fallback to legacy post.recipe (maps to image 0)
 */
function getRecipes(post: Post): ImageRecipe[] {
  if (post.recipes && post.recipes.length > 0) {
    return post.recipes;
  }

  const legacy = post.recipe;
  if (legacy && (legacy.title || (legacy.ingredients && legacy.ingredients.length > 0) || (legacy.steps && legacy.steps.length > 0))) {
    return [{
      imageIndex: 0,
      title: legacy.title || "Công thức",
      ingredients: legacy.ingredients || [],
      steps: legacy.steps || []
    }];
  }

  return [];
}

export function RecipeScreen({ navigation, route }: any) {
  const post: Post = route.params?.post;
  const recipes = getRecipes(post);
  const stickerSource = stickerImageSource(post.stickerId) ?? (post._id.startsWith("demo") ? DEMO_STICKER : null);
  const placement = post.stickerPlacement ?? { x: 0.75, y: 0.1, scale: 0.8, rotation: 0 };

  return (
    <FigmaLineBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.black} />
          </Pressable>
          <AppText style={styles.headerTitle}>Công thức</AppText>
          <View style={styles.headerRight}>
            {post.author?.avatarUrl ? (
              <Image source={authorAvatarSource(post.author.avatarUrl)} style={styles.headerAvatar} resizeMode="cover" />
            ) : post._id.startsWith("demo") ? (
              <Image source={DEMO_AUTHOR_AVATAR} style={styles.headerAvatar} resizeMode="cover" />
            ) : (
              <View style={styles.headerAvatar}>
                <AppText style={styles.headerAvatarText}>
                  {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
                </AppText>
              </View>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {recipes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={40} color={colors.muted} />
              <AppText style={styles.emptyText}>Chủ bài viết chưa thêm công thức.</AppText>
            </View>
          ) : (
            recipes.map((recipe, idx) => (
              <StaggerItem key={`recipe-${idx}`} index={idx}>
              <View style={styles.recipeCard}>
                {/* Food image with title tag and sticker */}
                <View style={styles.recipeImageWrap}>
                  <Image
                    source={recipeImageSource(post, recipe.imageIndex)}
                    style={styles.recipeImage}
                    resizeMode="cover"
                  />
                  {/* Title tag on image */}
                  <View style={styles.recipeTitleTag}>
                    <AppText style={styles.recipeTitleText} numberOfLines={1}>
                      {recipe.title || `Món ${idx + 1}`}
                    </AppText>
                  </View>
                  {/* Sticker on image */}
                  {stickerSource ? (
                    <Wiggle
                      style={[
                        styles.recipeSticker,
                        {
                          right: 12,
                          top: 8,
                          transform: [
                            { rotate: `${placement.rotation}deg` },
                            { scale: placement.scale }
                          ]
                        }
                      ]}
                    >
                      <Image
                        source={stickerSource}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    </Wiggle>
                  ) : null}
                </View>

                {/* Recipe content */}
                <View style={styles.recipeContent}>
                  {recipe.ingredients.length > 0 ? (
                    <View style={styles.recipeSection}>
                      <AppText style={styles.recipeSectionNum}>1. Chuẩn bị nguyên liệu</AppText>
                      {recipe.ingredients.map((item, i) => (
                        <AppText key={`ing-${i}`} style={styles.recipeItem}>• {item}</AppText>
                      ))}
                    </View>
                  ) : null}

                  {recipe.steps.length > 0 ? (
                    <View style={styles.recipeSection}>
                      <AppText style={styles.recipeSectionNum}>
                        {recipe.ingredients.length > 0 ? "2." : "1."} Cách làm
                      </AppText>
                      {recipe.steps.map((step, i) => (
                        <AppText key={`step-${i}`} style={styles.recipeItem}>
                          Bước {i + 1}: {step}
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              </StaggerItem>
            ))
          )}

          {/* Author chip at bottom */}
          <Pressable
            style={[styles.authorChip, { backgroundColor: post.author?.themeColor || colors.green }]}
            onPress={() => {
              if (!post._id.startsWith("demo") && post.author?.id) {
                navigation.navigate("PublicProfile", { userId: post.author.id });
              }
            }}
          >
            <View style={styles.authorAvatar}>
              {post.author?.avatarUrl ? (
                <Image source={authorAvatarSource(post.author.avatarUrl)} style={styles.authorAvatarImg} resizeMode="cover" />
              ) : post._id.startsWith("demo") ? (
                <Image source={DEMO_AUTHOR_AVATAR} style={styles.authorAvatarImg} resizeMode="cover" />
              ) : (
                <AppText style={styles.authorInitial}>
                  {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
                </AppText>
              )}
            </View>
            <AppText style={styles.authorName} numberOfLines={1}>
              {post.author?.displayName ?? "Daily Meal"}
            </AppText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </FigmaLineBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.black
  },
  headerRight: {
    alignItems: "center"
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvasStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  headerAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.green
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20
  },
  emptyCard: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6
  },
  recipeImageWrap: {
    width: "100%",
    aspectRatio: 1.2,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
    position: "relative"
  },
  recipeImage: {
    width: "100%",
    height: "100%"
  },
  recipeTitleTag: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: "70%",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  recipeTitleText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.black
  },
  recipeSticker: {
    position: "absolute",
    width: 56,
    height: 56,
    zIndex: 99,
    elevation: 15
  },
  recipeContent: {
    padding: 16,
    gap: 14
  },
  recipeSection: {
    gap: 4
  },
  recipeSectionNum: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.black,
    marginBottom: 4
  },
  recipeItem: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 22,
    paddingLeft: 4
  },
  authorChip: {
    alignSelf: "center",
    maxWidth: "80%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    borderRadius: 24,
    marginTop: 8
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 18
  },
  authorInitial: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.green
  },
  authorName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 15
  }
});
