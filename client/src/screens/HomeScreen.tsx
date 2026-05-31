import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewToken
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { AppText } from "../components/AppText";
import { FigmaLineBackground } from "../components/AppScreen";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { demoPosts } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, PostLayout } from "../types/api";
import { stickerImageSource } from "../utils/stickers";

const PHONE_MAX_WIDTH = 383;
const ARTWORK_MAX_WIDTH = 330;
const ARTWORK_ASPECT_RATIO = 1.12;

const DEMO_IMAGES = [
  require("../../assets/feed/home-food-back.png"),
  require("../../assets/feed/home-food-mid.png"),
  require("../../assets/feed/home-food-main.png")
];

const DEMO_STICKER = require("../../assets/feed/home-sticker.png");
const DEMO_AUTHOR_AVATAR = require("../../assets/feed/home-author.png");

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

function isDesktopPointer() {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function HomeScreen({ navigation }: any) {
  const { width: viewportWidth } = useWindowDimensions();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [showCategory, setShowCategory] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Real-time feed interaction updates
  useEffect(() => {
    if (!socket) return;

    socket.on("post:stats-updated", ({ postId, stats }: { postId: string; stats: any }) => {
      console.log(`📊 Live stats updated for post: ${postId}`, stats);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                stats: {
                  ...post.stats,
                  ...stats
                }
              }
            : post
        )
      );
    });

    return () => {
      socket.off("post:stats-updated");
    };
  }, [socket]);

  const load = useCallback(async (jumpToTop = false) => {
    if (!token) return;
    try {
      const result = await api.feed(token);
      const feedPosts = result.posts.length ? result.posts : demoPosts;
      setPosts(feedPosts);

      // Populate liked and saved sets from database viewerState on page load
      const initialLikes = new Set<string>();
      const initialSaves = new Set<string>();
      feedPosts.forEach((post) => {
        if (post.viewerState?.liked) {
          initialLikes.add(post._id);
        }
        if (post.viewerState?.saved) {
          initialSaves.add(post._id);
        }
      });
      setLikedSet(initialLikes);
      setSavedSet(initialSaves);

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
  const showDesktopFrame = viewportWidth >= 720 && isDesktopPointer();

  async function handleLike() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    const isCurrentlyLiked = likedSet.has(postId);

    // Optimistic UI updates
    setLikedSet((current) => toggleSet(current, postId));
    setPosts((currentPosts) =>
      currentPosts.map((p) =>
        p._id === postId
          ? {
              ...p,
              stats: {
                ...p.stats,
                likes: Math.max(0, (p.stats?.likes ?? 0) + (isCurrentlyLiked ? -1 : 1))
              }
            }
          : p
      )
    );

    try {
      if (!postId.startsWith("demo")) {
        await api.likePost(token, postId);
      }
    } catch {
      // Revert optimistic updates on error
      setLikedSet((current) => toggleSet(current, postId));
      setPosts((currentPosts) =>
        currentPosts.map((p) =>
          p._id === postId
            ? {
                ...p,
                stats: {
                  ...p.stats,
                  likes: Math.max(0, (p.stats?.likes ?? 0) + (isCurrentlyLiked ? 1 : -1))
                }
              }
            : p
        )
      );
    }
  }

  async function handleSave() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    const isCurrentlySaved = savedSet.has(postId);

    // Optimistic UI updates
    setSavedSet((current) => toggleSet(current, postId));
    setPosts((currentPosts) =>
      currentPosts.map((p) =>
        p._id === postId
          ? {
              ...p,
              stats: {
                ...p.stats,
                saves: Math.max(0, (p.stats?.saves ?? 0) + (isCurrentlySaved ? -1 : 1))
              }
            }
          : p
      )
    );

    try {
      if (!postId.startsWith("demo")) {
        await api.savePost(token, postId);
      }
    } catch {
      // Revert optimistic updates on error
      setSavedSet((current) => toggleSet(current, postId));
      setPosts((currentPosts) =>
        currentPosts.map((p) =>
          p._id === postId
            ? {
                ...p,
                stats: {
                  ...p.stats,
                  saves: Math.max(0, (p.stats?.saves ?? 0) + (isCurrentlySaved ? 1 : -1))
                }
              }
            : p
        )
      );
    }
  }

  function handleComment() {
    if (!currentPost) return;
    navigation.navigate("Comments", { post: currentPost });
  }

  return (
    <FigmaLineBackground>
      <SafeAreaView style={[styles.safe, showDesktopFrame && styles.phoneFrame]} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <AppText style={styles.headerTitle}>Bảng tin</AppText>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerIconBtn} hitSlop={8}>
              <Ionicons name="notifications" size={23} color={colors.black} />
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={() => navigation.navigate("Profile")} hitSlop={8}>
              <Ionicons name="person" size={24} color={colors.black} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.feedWrap}
          onLayout={(event) => {
            setListHeight(event.nativeEvent.layout.height);
            setListWidth(event.nativeEvent.layout.width);
          }}
        >
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
                  slideWidth={listWidth}
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

        <View style={[styles.bottomBar, showDesktopFrame && styles.desktopBottomBar]}>
          <Pressable style={styles.squareBtn} onPress={() => setShowCategory(true)} hitSlop={6}>
            <Ionicons name="grid" size={28} color={colors.black} />
          </Pressable>

          <View style={styles.actionPill}>
            <Pressable style={styles.pillBtn} onPress={handleComment} hitSlop={4}>
              <Ionicons name="chatbubble" size={24} color={colors.white} />
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={handleLike} hitSlop={4}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? colors.red : colors.white} />
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={handleSave} hitSlop={4}>
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={25} color={isSaved ? colors.yellow : colors.white} />
            </Pressable>
          </View>

          <Pressable style={styles.squareBtn} onPress={() => navigation.navigate("Create")} hitSlop={6}>
            <Ionicons name="camera" size={28} color={colors.black} />
          </Pressable>
        </View>

        <CategoryModal
          visible={showCategory}
          onClose={() => setShowCategory(false)}
          onNavigate={(screen) => navigation.navigate(screen)}
        />
      </SafeAreaView>
    </FigmaLineBackground>
  );
}

function PostSlide({
  post,
  index,
  slideHeight,
  slideWidth,
  onPress,
  onRecipePress
}: {
  post: Post;
  index: number;
  slideHeight: number;
  slideWidth: number;
  onPress: () => void;
  onRecipePress: () => void;
}) {
  const artworkWidth = Math.min(Math.max(slideWidth - 60, 280), ARTWORK_MAX_WIDTH);
  const artworkHeight = Math.min(Math.round(artworkWidth * ARTWORK_ASPECT_RATIO), Math.max(slideHeight - 170, 300));

  return (
    <View style={[styles.slide, { height: slideHeight }]}>
      <Pressable style={[styles.artworkPress, { width: artworkWidth, height: artworkHeight }]} onPress={onPress}>
        <View style={[styles.feedArtwork, { transform: [{ rotate: cardRotation(index) }] }]}>
          <FeedArtwork post={post} />

          {post.recipe?.title || post.recipe?.ingredients?.length ? (
            <Pressable style={styles.recipeChip} onPress={onRecipePress}>
              <AppText style={styles.recipeChipText}>Công thức</AppText>
            </Pressable>
          ) : null}

          <View style={styles.statsChip}>
            <AppText style={styles.statsNum}>{post.stats?.comments ?? 0}</AppText>
            <Ionicons name="chatbubble-outline" size={15} color={colors.black} />
            <AppText style={styles.statsNum}>{post.stats?.likes ?? 0}</AppText>
            <Ionicons name="heart" size={15} color={colors.red} />
          </View>

          {post.nutritionSummary?.calories ? (
            <View style={styles.caloBadge}>
              <AppText style={styles.caloText}>{Math.round(post.nutritionSummary.calories)} Calo</AppText>
            </View>
          ) : null}

          <View style={styles.captionChip}>
            <Ionicons name="location" size={17} color={colors.black} />
            <AppText numberOfLines={1} style={styles.captionText}>
              {post.caption || "Nó ngon phải biết"}
            </AppText>
          </View>
        </View>
      </Pressable>

      <View style={styles.authorChip}>
        <View style={styles.authorAvatar}>
          {post._id.startsWith("demo") ? (
            <Image source={DEMO_AUTHOR_AVATAR} style={styles.authorAvatarImage} resizeMode="cover" />
          ) : (
            <AppText style={styles.authorAvatarText}>
              {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
            </AppText>
          )}
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
  const stickerSource = stickerImageSource(post.stickerId) ?? (post._id.startsWith("demo") ? DEMO_STICKER : null);
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
    return { width: "86%" as const, height: "82%" as const, left: "7%" as const, top: "10%" as const, baseRotation: 0 };
  }

  if (layout === "grid") {
    if (count === 2) {
      return [
        { width: "52%" as const, height: "66%" as const, left: "3%" as const, top: "18%" as const, baseRotation: -2 },
        { width: "52%" as const, height: "66%" as const, left: "45%" as const, top: "18%" as const, baseRotation: 2 }
      ][index];
    }
    return [
      { width: "78%" as const, height: "78%" as const, left: "4%" as const, top: "10%" as const, baseRotation: -6 },
      { width: "78%" as const, height: "78%" as const, left: "10%" as const, top: "5%" as const, baseRotation: 3 },
      { width: "78%" as const, height: "78%" as const, left: "8%" as const, top: "12%" as const, baseRotation: 0 }
    ][index];
  }

  if (layout === "cascade") {
    return [
      { width: "78%" as const, height: "78%" as const, left: "4%" as const, top: "10%" as const, baseRotation: -6 },
      { width: "78%" as const, height: "78%" as const, left: "10%" as const, top: "5%" as const, baseRotation: 3 },
      { width: "78%" as const, height: "78%" as const, left: "8%" as const, top: "12%" as const, baseRotation: 0 }
    ][index];
  }

  return [
    { width: "78%" as const, height: "78%" as const, left: "4%" as const, top: "10%" as const, baseRotation: -6 },
    { width: "78%" as const, height: "78%" as const, left: "10%" as const, top: "5%" as const, baseRotation: 3 },
    { width: "78%" as const, height: "78%" as const, left: "8%" as const, top: "12%" as const, baseRotation: 0 }
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
    flex: 1,
    overflow: "hidden"
  },
  phoneFrame: {
    width: "100%",
    maxWidth: PHONE_MAX_WIDTH,
    alignSelf: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.black,
    borderRadius: 40,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: "hidden"
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
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  feedWrap: {
    flex: 1,
    overflow: "hidden",
    paddingTop: 6
  },
  slide: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 70,
    overflow: "hidden"
  },
  artworkPress: {
    width: "100%",
    height: "100%"
  },
  feedArtwork: {
    width: "100%",
    height: "100%"
  },
  feedArtworkCanvas: {
    flex: 1,
    overflow: "visible"
  },
  feedImageWrap: {
    position: "absolute",
    borderRadius: 22,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7
  },
  feedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 22
  },
  recipeChip: {
    position: "absolute",
    top: 24,
    left: 0,
    zIndex: 90,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  recipeChipText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18
  },
  statsChip: {
    position: "absolute",
    top: 22,
    right: 0,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  statsNum: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.black
  },
  caloBadge: {
    position: "absolute",
    top: 62,
    right: 0,
    zIndex: 90,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  caloText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.black
  },
  captionChip: {
    position: "absolute",
    left: 0,
    bottom: 22,
    zIndex: 90,
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  captionText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 19
  },
  feedSticker: {
    position: "absolute",
    width: 78,
    height: 78,
    zIndex: 80
  },
  authorChip: {
    marginTop: 16,
    minWidth: 176,
    maxWidth: "86%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.green,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 22,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  authorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 15
  },
  authorAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.green
  },
  authorName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20
  },
  swipeHint: {
    marginTop: 8,
    opacity: 0.35
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
    paddingTop: 8,
    paddingBottom: 8,
    width: "100%",
    alignSelf: "center"
  },
  desktopBottomBar: {
    maxWidth: PHONE_MAX_WIDTH
  },
  squareBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 16
  },
  pillBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
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
