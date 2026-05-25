import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewToken
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { demoPosts } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, PostLayout } from "../types/api";
import { stickerImageSource } from "../utils/stickers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTWORK_WIDTH = Math.min(SCREEN_WIDTH - 52, 330);
const ARTWORK_HEIGHT = Math.round(ARTWORK_WIDTH * 1.03);

const DEMO_IMAGES = [
  require("../../assets/figma-snapshots/image1.png"),
  require("../../assets/figma-snapshots/image3.png"),
  require("../../assets/figma-snapshots/image10.png")
];

const CATEGORY_ITEMS = [
  { icon: "search-outline" as const, label: "Tìm kiếm", screen: "Search" },
  { icon: "chatbubbles-outline" as const, label: "Tin nhắn", screen: "Inbox" },
  { icon: "person-outline" as const, label: "Hồ sơ", screen: "Profile" },
  { icon: "settings-outline" as const, label: "Cài đặt", screen: "Settings" }
] as const;

function imageSource(post: Post, index: number) {
  const url = post.images[index]?.url ?? post.images[0]?.url;
  if (!url) return DEMO_IMAGES[index % DEMO_IMAGES.length];
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${api.baseUrl}${url}` };
}

function cardRotation(index: number) {
  return index % 2 === 0 ? "-1.5deg" : "1.5deg";
}

export function HomeScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [showCategory, setShowCategory] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const load = useCallback(async (jumpToTop = false) => {
    if (!token) return;
    try {
      const result = await api.feed(token);
      setPosts(result.posts.length ? result.posts : demoPosts);
      if (jumpToTop) {
        setCurrentIndex(0);
        requestAnimationFrame(() => {
          flatRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      }
    } catch {
      setPosts(demoPosts);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrentIndex(first.index);
  }, []);

  const currentPost = posts[currentIndex];
  const isLiked = currentPost ? likedSet.has(currentPost._id) : false;
  const isSaved = currentPost ? savedSet.has(currentPost._id) : false;

  async function handleLike() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    setLikedSet((current) => toggleSet(current, postId));
    try {
      if (!postId.startsWith("demo")) await api.likePost(token, postId);
    } catch {
      setLikedSet((current) => toggleSet(current, postId));
    }
  }

  async function handleSave() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    setSavedSet((current) => toggleSet(current, postId));
    try {
      if (!postId.startsWith("demo")) await api.savePost(token, postId);
    } catch {
      setSavedSet((current) => toggleSet(current, postId));
    }
  }

  function handleComment() {
    if (!currentPost) return;
    navigation.navigate("Comments", { post: currentPost });
  }

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background2.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <AppText style={styles.headerTitle}>Bảng tin</AppText>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerIconBtn} hitSlop={8}>
              <Ionicons name="notifications" size={18} color={colors.black} />
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={() => navigation.navigate("Profile")} hitSlop={8}>
              <Ionicons name="person" size={19} color={colors.black} />
            </Pressable>
          </View>
        </View>

        <View style={styles.feedWrap} onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
          {listHeight > 0 ? (
            <FlatList
              ref={flatRef}
              data={posts}
              keyExtractor={(item) => item._id}
              renderItem={({ item, index }) => (
                <PostSlide
                  post={item}
                  index={index}
                  slideHeight={listHeight}
                  onPress={() => navigation.navigate("Comments", { post: item })}
                  onRecipePress={() => navigation.navigate("Recipe", { post: item })}
                />
              )}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: listHeight,
                offset: listHeight * index,
                index
              })}
              snapToInterval={listHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              extraData={currentIndex}
            />
          ) : null}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable style={styles.squareBtn} onPress={() => setShowCategory(true)} hitSlop={6}>
            <Ionicons name="grid" size={20} color={colors.black} />
          </Pressable>

          <View style={styles.actionPill}>
            <Pressable style={styles.pillBtn} onPress={handleComment} hitSlop={4}>
              <Ionicons name="chatbubble" size={17} color={colors.white} />
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={handleLike} hitSlop={4}>
              <Ionicons name="heart" size={18} color={isLiked ? colors.red : colors.red} />
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={handleSave} hitSlop={4}>
              <Ionicons name="bookmark" size={17} color={isSaved ? colors.yellow : colors.yellow} />
            </Pressable>
          </View>

          <Pressable style={styles.squareBtn} onPress={() => navigation.navigate("Create")} hitSlop={6}>
            <Ionicons name="camera" size={20} color={colors.black} />
          </Pressable>
        </View>

        <CategoryModal
          visible={showCategory}
          onClose={() => setShowCategory(false)}
          onNavigate={(screen) => navigation.navigate(screen)}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

function PostSlide({
  post,
  index,
  slideHeight,
  onPress,
  onRecipePress
}: {
  post: Post;
  index: number;
  slideHeight: number;
  onPress: () => void;
  onRecipePress: () => void;
}) {
  return (
    <View style={[styles.slide, { height: slideHeight }]}>
      <Pressable style={styles.artworkPress} onPress={onPress}>
        <View style={[styles.feedArtwork, { transform: [{ rotate: cardRotation(index) }] }]}>
          <FeedArtwork post={post} />

          {post.recipe?.title || post.recipe?.ingredients?.length ? (
            <Pressable style={styles.recipeChip} onPress={onRecipePress}>
              <AppText style={styles.recipeChipText}>Công thức</AppText>
            </Pressable>
          ) : null}

          <View style={styles.statsChip}>
            <AppText style={styles.statsNum}>{post.stats?.comments ?? 0}</AppText>
            <Ionicons name="chatbubble-outline" size={12} color={colors.black} />
            <AppText style={styles.statsNum}>{post.stats?.likes ?? 0}</AppText>
            <Ionicons name="heart" size={12} color={colors.red} />
          </View>

          {post.nutritionSummary?.calories ? (
            <View style={styles.caloBadge}>
              <AppText style={styles.caloText}>{Math.round(post.nutritionSummary.calories)} Calo</AppText>
            </View>
          ) : null}

          <View style={styles.captionChip}>
            <Ionicons name="location" size={13} color={colors.black} />
            <AppText numberOfLines={1} style={styles.captionText}>
              {post.caption || "Nó ngon phải biết"}
            </AppText>
          </View>
        </View>
      </Pressable>

      <View style={styles.authorChip}>
        <View style={styles.authorAvatar}>
          <AppText style={styles.authorAvatarText}>
            {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
          </AppText>
        </View>
        <AppText style={styles.authorName} numberOfLines={1}>
          {post.author?.displayName ?? "Daily Meal"}
        </AppText>
      </View>

      <View style={styles.swipeHint}>
        <Ionicons name="chevron-up" size={16} color={colors.muted} />
      </View>
    </View>
  );
}

function FeedArtwork({ post }: { post: Post }) {
  const imageCount = Math.max(post.images.length, 1);
  const layout = post.layout ?? "stack";
  const stickerSource = stickerImageSource(post.stickerId);
  const placement = post.stickerPlacement ?? { x: 0.78, y: 0.78, scale: 1, rotation: 0 };

  return (
    <View style={styles.feedArtworkCanvas}>
      {Array.from({ length: Math.min(imageCount, 3) }).map((_, index) => {
        const transform = post.imageTransforms?.[index] ?? {
          scale: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0
        };
        const { baseRotation, ...position } = feedImagePosition(layout, imageCount, index);
        return (
          <View
            key={`${post._id}-${index}`}
            style={[
              styles.feedImageWrap,
              position,
              {
                zIndex: 10 + index,
                transform: [
                  { translateX: transform.offsetX * 0.35 },
                  { translateY: transform.offsetY * 0.35 },
                  { rotate: `${baseRotation + transform.rotation}deg` },
                  { scale: transform.scale }
                ]
              }
            ]}
          >
            <Image source={imageSource(post, index)} style={styles.feedImage} resizeMode="cover" />
          </View>
        );
      })}

      {stickerSource ? (
        <Image
          source={stickerSource}
          style={[
            styles.feedSticker,
            {
              left: `${placement.x * 100}%`,
              top: `${placement.y * 100}%`,
              transform: [
                { translateX: -25 },
                { translateY: -25 },
                { rotate: `${placement.rotation}deg` },
                { scale: placement.scale }
              ]
            }
          ]}
        />
      ) : null}
    </View>
  );
}

function feedImagePosition(layout: PostLayout, count: number, index: number) {
  if (count === 1) {
    return { width: "78%" as const, height: "78%" as const, left: "11%" as const, top: "10%" as const, baseRotation: 0 };
  }

  if (layout === "grid") {
    if (count === 2) {
      return [
        { width: "48%" as const, height: "62%" as const, left: "4%" as const, top: "20%" as const, baseRotation: -1 },
        { width: "48%" as const, height: "62%" as const, left: "48%" as const, top: "20%" as const, baseRotation: 2 }
      ][index];
    }
    return [
      { width: "55%" as const, height: "55%" as const, left: "7%" as const, top: "14%" as const, baseRotation: -2 },
      { width: "44%" as const, height: "44%" as const, left: "50%" as const, top: "28%" as const, baseRotation: 2 },
      { width: "36%" as const, height: "36%" as const, left: "28%" as const, top: "61%" as const, baseRotation: -4 }
    ][index];
  }

  if (layout === "cascade") {
    return [
      { width: "68%" as const, height: "68%" as const, left: "10%" as const, top: "11%" as const, baseRotation: -6 },
      { width: "68%" as const, height: "68%" as const, left: "22%" as const, top: "18%" as const, baseRotation: 5 },
      { width: "56%" as const, height: "56%" as const, left: "36%" as const, top: "35%" as const, baseRotation: 8 }
    ][index];
  }

  return [
    { width: "74%" as const, height: "74%" as const, left: "10%" as const, top: "12%" as const, baseRotation: -4 },
    { width: "74%" as const, height: "74%" as const, left: "17%" as const, top: "8%" as const, baseRotation: 6 },
    { width: "74%" as const, height: "74%" as const, left: "13%" as const, top: "15%" as const, baseRotation: 0 }
  ][index];
}

function CategoryModal({
  visible,
  onClose,
  onNavigate
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <AppText variant="subtitle" style={styles.sheetTitle}>Tính năng</AppText>
          <View style={styles.categoryGrid}>
            {CATEGORY_ITEMS.map((item) => (
              <Pressable
                key={item.label}
                style={styles.categoryItem}
                onPress={() => {
                  onClose();
                  onNavigate(item.screen);
                }}
              >
                <View style={styles.categoryIconWrap}>
                  <Ionicons name={item.icon} size={24} color={colors.black} />
                </View>
                <AppText variant="caption" style={styles.categoryLabel}>{item.label}</AppText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  safe: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 29,
    lineHeight: 38,
    color: colors.black,
    letterSpacing: 0
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  feedWrap: {
    flex: 1,
    overflow: "hidden"
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  artworkPress: {
    width: ARTWORK_WIDTH,
    height: ARTWORK_HEIGHT
  },
  feedArtwork: {
    width: "100%",
    height: "100%"
  },
  feedArtworkCanvas: {
    flex: 1
  },
  feedImageWrap: {
    position: "absolute",
    borderRadius: 18,
    backgroundColor: colors.canvasStrong,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7
  },
  feedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18
  },
  recipeChip: {
    position: "absolute",
    top: 28,
    left: 6,
    zIndex: 90,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  recipeChipText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 11
  },
  statsChip: {
    position: "absolute",
    top: 26,
    right: 10,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  statsNum: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.black
  },
  caloBadge: {
    position: "absolute",
    top: 60,
    right: 12,
    zIndex: 90,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  caloText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.black
  },
  captionChip: {
    position: "absolute",
    left: 6,
    bottom: 25,
    zIndex: 90,
    maxWidth: "72%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  captionText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 11
  },
  feedSticker: {
    position: "absolute",
    width: 62,
    height: 62,
    zIndex: 80
  },
  authorChip: {
    marginTop: 12,
    minWidth: 142,
    maxWidth: ARTWORK_WIDTH - 42,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.green,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 18,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  authorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.green
  },
  authorName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 12
  },
  swipeHint: {
    marginTop: 8,
    opacity: 0.35
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 46,
    paddingTop: 10
  },
  squareBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10
  },
  pillBtn: {
    width: 24,
    alignItems: "center"
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 18
  },
  sheetTitle: {
    marginBottom: 20
  },
  categoryGrid: {
    flexDirection: "row",
    gap: 14
  },
  categoryItem: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  categoryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  categoryLabel: {
    color: colors.muted,
    textAlign: "center"
  }
});
