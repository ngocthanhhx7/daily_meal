import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewToken
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { AppText } from "../components/AppText";
import { FigmaLineBackground } from "../components/AppScreen";
import { BouncePress, FadeSlideIn, Wiggle, Pulse } from "../components/Animations";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useNotifications } from "../context/NotificationContext";
import { demoPosts } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, PostLayout } from "../types/api";
import { stickerImageSource } from "../utils/stickers";
import { getNutritionDetailSections } from "./postNutrition";
import { CameraIcon, CategoryIcon } from "../components/SvgIcons";

const PHONE_MAX_WIDTH = 383;
const ARTWORK_MAX_WIDTH = 380;
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

export function authorAvatarSource(avatarUrl?: string) {
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
  const { unreadCount } = useNotifications();
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [showCategory, setShowCategory] = useState(false);
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [nutritionPost, setNutritionPost] = useState<Post | null>(null);
  const flatRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Animation refs
  const heartScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  function bounceHeart() {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.5, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true })
    ]).start();
  }
  function bounceSave() {
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 1.4, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true })
    ]).start();
  }

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
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate("Notifications")}
              hitSlop={8}
            >
              <Ionicons name="notifications" size={28} color={colors.black} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <AppText style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </AppText>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={() => navigation.navigate("Profile")} hitSlop={8}>
              <Ionicons name="person" size={30} color={colors.black} />
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
                  onPress={() => setExpandedPost(item)}
                  onNutritionPress={() => setNutritionPost(item)}
                  onRecipePress={() => navigation.navigate("Recipe", { post: item })}
                  onAuthorPress={() => {
                    if (!item._id.startsWith("demo") && item.author?.id) {
                      navigation.navigate("PublicProfile", { userId: item.author.id });
                    } else {
                      navigation.navigate("Profile");
                    }
                  }}
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

        <FadeSlideIn delay={200} slideDistance={20} duration={500}>
          <View style={[styles.bottomBar, showDesktopFrame && styles.desktopBottomBar]}>
            <BouncePress style={styles.squareBtn} onPress={() => setShowCategory(true)} hitSlop={6}>
              <CategoryIcon size={30} color={colors.black} />
            </BouncePress>

            <View style={styles.actionPill}>
              <BouncePress style={styles.pillBtn} onPress={handleComment} hitSlop={4}>
                <Ionicons name="chatbubble" size={24} color={colors.white} />
              </BouncePress>
              <Pressable style={styles.pillBtn} onPress={() => { bounceHeart(); handleLike(); }} hitSlop={4}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? colors.red : colors.white} />
                </Animated.View>
              </Pressable>
              <Pressable style={styles.pillBtn} onPress={() => { bounceSave(); handleSave(); }} hitSlop={4}>
                <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                  <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={25} color={isSaved ? colors.yellow : colors.white} />
                </Animated.View>
              </Pressable>
            </View>

            <BouncePress style={styles.squareBtn} onPress={() => navigation.navigate("Create")} hitSlop={6}>
              <CameraIcon size={30} color={colors.black} />
            </BouncePress>
          </View>
        </FadeSlideIn>

        <ExpandedPostModal
          post={expandedPost}
          onClose={() => setExpandedPost(null)}
          onRecipePress={() => {
            const post = expandedPost;
            setExpandedPost(null);
            if (post) navigation.navigate("Recipe", { post });
          }}
          onCommentPress={() => {
            const post = expandedPost;
            setExpandedPost(null);
            if (post) navigation.navigate("Comments", { post });
          }}
          onAuthorPress={() => {
            const post = expandedPost;
            setExpandedPost(null);
            if (post && !post._id.startsWith("demo") && post.author?.id) {
              navigation.navigate("PublicProfile", { userId: post.author.id });
            } else {
              navigation.navigate("Profile");
            }
          }}
        />

        <NutritionDetailModal post={nutritionPost} onClose={() => setNutritionPost(null)} />

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
  onNutritionPress,
  onRecipePress,
  onAuthorPress
}: {
  post: Post;
  index: number;
  slideHeight: number;
  slideWidth: number;
  onPress: () => void;
  onNutritionPress: () => void;
  onRecipePress: () => void;
  onAuthorPress: () => void;
}) {
  const artworkWidth = Math.min(Math.max(slideWidth - 36, 280), ARTWORK_MAX_WIDTH);
  const artworkHeight = Math.min(Math.round(artworkWidth * ARTWORK_ASPECT_RATIO), Math.max(slideHeight - 130, 320));

  return (
    <View style={[styles.slide, { height: slideHeight }]}>
      <Pressable style={[styles.artworkPress, { width: artworkWidth, height: artworkHeight }]} onPress={onPress}>
        <View style={[styles.feedArtwork, { transform: [{ rotate: cardRotation(index) }] }]}>
          <FeedArtwork post={post} />

          {(post.recipe?.title || post.recipe?.ingredients?.length || (post.recipes && post.recipes.length > 0)) ? (
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
            <Pressable style={styles.caloBadge} onPress={onNutritionPress} hitSlop={6}>
              <AppText style={styles.caloText}>{Math.round(post.nutritionSummary.calories)} Calo</AppText>
            </Pressable>
          ) : null}

          <View style={styles.captionChip}>
            <Ionicons name="location" size={17} color={colors.black} />
            <AppText numberOfLines={1} style={styles.captionText}>
              {post.caption || "Nó ngon phải biết"}
            </AppText>
          </View>
        </View>
      </Pressable>

      <Pressable
        style={[styles.authorChip, { backgroundColor: post.author?.themeColor || colors.green }]}
        onPress={onAuthorPress}
      >
        <View style={styles.authorAvatar}>
          {post.author?.avatarUrl ? (
            <Image
              source={authorAvatarSource(post.author.avatarUrl)}
              style={styles.authorAvatarImage}
              resizeMode="cover"
            />
          ) : post._id.startsWith("demo") ? (
            <Image source={DEMO_AUTHOR_AVATAR} style={styles.authorAvatarImage} resizeMode="cover" />
          ) : (
            <AppText style={[styles.authorAvatarText, { color: post.author?.themeColor || colors.green }]}>
              {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
            </AppText>
          )}
        </View>
        <AppText style={styles.authorName} numberOfLines={1}>
          {post.author?.displayName ?? "Daily Meal"}
        </AppText>
      </Pressable>
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
        <Wiggle
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
        >
          <Image
            source={stickerSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </Wiggle>
      ) : null}
    </View>
  );
}

function feedImagePosition(layout: PostLayout, count: number, index: number) {
  if (count === 1) {
    return { width: "92%" as const, height: "88%" as const, left: "4%" as const, top: "6%" as const, baseRotation: 0 };
  }

  if (layout === "grid") {
    if (count === 2) {
      return [
        { width: "55%" as const, height: "72%" as const, left: "2%" as const, top: "14%" as const, baseRotation: -2 },
        { width: "55%" as const, height: "72%" as const, left: "43%" as const, top: "14%" as const, baseRotation: 2 }
      ][index];
    }
    return [
      { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
      { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
      { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 }
    ][index];
  }

  if (layout === "cascade") {
    return [
      { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
      { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
      { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 }
    ][index];
  }

  return [
    { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
    { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
    { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 }
  ][index];
}

function hasRecipe(post: Post) {
  return !!(post.recipe?.title || post.recipe?.ingredients?.length || (post.recipes && post.recipes.length > 0));
}

function ExpandedPostModal({
  post,
  onClose,
  onRecipePress,
  onCommentPress,
  onAuthorPress
}: {
  post: Post | null;
  onClose: () => void;
  onRecipePress: () => void;
  onCommentPress: () => void;
  onAuthorPress: () => void;
}) {
  if (!post) return null;

  const screenWidth = Dimensions.get("window").width;
  const imgCount = Math.max(post.images.length, 1);
  const stickerSource = stickerImageSource(post.stickerId) ?? (post._id.startsWith("demo") ? DEMO_STICKER : null);
  const placement = post.stickerPlacement ?? { x: 0.78, y: 0.78, scale: 1, rotation: 0 };
  const gridPadding = 20;
  const gridGap = 10;
  const availableWidth = Math.min(screenWidth - gridPadding * 2, 380);

  function renderImageGrid() {
    if (imgCount === 1) {
      return (
        <View style={expandedStyles.singleImageWrap}>
          <Image source={imageSource(post!, 0)} style={expandedStyles.singleImage} resizeMode="cover" />
        </View>
      );
    }

    if (imgCount === 2) {
      const itemW = (availableWidth - gridGap) / 2;
      return (
        <View style={expandedStyles.gridRow}>
          {[0, 1].map((i) => (
            <View key={i} style={[expandedStyles.gridItem, { width: itemW, height: itemW * 1.2 }]}>
              <Image source={imageSource(post!, i)} style={expandedStyles.gridImage} resizeMode="cover" />
            </View>
          ))}
        </View>
      );
    }

    // 3 images: 2 on top row, 1 on bottom row centered
    const topItemW = (availableWidth - gridGap) / 2;
    const bottomItemW = topItemW;
    return (
      <View style={expandedStyles.gridWrap}>
        <View style={expandedStyles.gridRow}>
          {[0, 1].map((i) => (
            <View key={i} style={[expandedStyles.gridItem, { width: topItemW, height: topItemW * 1.15 }]}>
              <Image source={imageSource(post!, i)} style={expandedStyles.gridImage} resizeMode="cover" />
            </View>
          ))}
        </View>
        <View style={expandedStyles.gridRowCenter}>
          <View style={[expandedStyles.gridItem, { width: bottomItemW, height: bottomItemW * 1.15 }]}>
            <Image source={imageSource(post!, 2)} style={expandedStyles.gridImage} resizeMode="cover" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={expandedStyles.overlay} onPress={onClose}>
        <Pressable style={expandedStyles.container} onPress={() => { }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={expandedStyles.scrollContent}>
            {/* Caption chip */}
            <View style={expandedStyles.headerRow}>
              <View style={expandedStyles.captionBubble}>
                <AppText numberOfLines={2} style={expandedStyles.captionText}>
                  {post.caption || "Nó ngon phải biết"}
                </AppText>
              </View>
              {stickerSource ? (
                <Wiggle>
                  <Image source={stickerSource} style={expandedStyles.headerSticker} resizeMode="contain" />
                </Wiggle>
              ) : null}
            </View>

            {/* Stats */}
            <View style={expandedStyles.statsRow}>
              <AppText style={expandedStyles.statsNum}>{post.stats?.comments ?? 0}</AppText>
              <Ionicons name="chatbubble-outline" size={15} color={colors.black} />
              <AppText style={expandedStyles.statsNum}>{post.stats?.likes ?? 0}</AppText>
              <Ionicons name="heart" size={15} color={colors.red} />
            </View>

            {/* Image grid */}
            {renderImageGrid()}

            {/* Recipe dashed circle button */}
            {hasRecipe(post) ? (
              <Pressable style={expandedStyles.recipeDashedBtn} onPress={onRecipePress}>
                <View style={expandedStyles.recipeDashedCircle}>
                  <Ionicons name="clipboard-outline" size={28} color={colors.muted} />
                </View>
                <AppText style={expandedStyles.recipeDashedLabel}>Công thức</AppText>
              </Pressable>
            ) : null}

            {/* Author chip */}
            <Pressable
              style={[expandedStyles.authorChip, { backgroundColor: post.author?.themeColor || colors.green }]}
              onPress={onAuthorPress}
            >
              <View style={expandedStyles.authorAvatar}>
                {post.author?.avatarUrl ? (
                  <Image source={authorAvatarSource(post.author.avatarUrl)} style={expandedStyles.authorAvatarImg} resizeMode="cover" />
                ) : post._id.startsWith("demo") ? (
                  <Image source={DEMO_AUTHOR_AVATAR} style={expandedStyles.authorAvatarImg} resizeMode="cover" />
                ) : (
                  <AppText style={expandedStyles.authorInitial}>
                    {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
                  </AppText>
                )}
              </View>
              <AppText style={expandedStyles.authorName} numberOfLines={1}>
                {post.author?.displayName ?? "Daily Meal"}
              </AppText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const expandedStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center"
  },
  container: {
    width: "90%",
    maxWidth: 400,
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    alignItems: "center"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%"
  },
  captionBubble: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  captionText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.black
  },
  headerSticker: {
    width: 48,
    height: 48
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-end",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  statsNum: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.black
  },
  singleImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.canvasStrong
  },
  singleImage: {
    width: "100%",
    height: "100%"
  },
  gridWrap: {
    width: "100%",
    gap: 10
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%"
  },
  gridRowCenter: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%"
  },
  gridItem: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.canvasStrong,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4
  },
  gridImage: {
    width: "100%",
    height: "100%"
  },
  recipeDashedBtn: {
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  recipeDashedCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  recipeDashedLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted
  },
  authorChip: {
    alignSelf: "center",
    maxWidth: "86%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 4
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

function NutritionDetailModal({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  if (!post) {
    return null;
  }

  const sections = getNutritionDetailSections(post);
  const total = post.nutritionSummary;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.nutritionSheet, { paddingBottom: insets.bottom + 18 }]} onPress={() => { }}>
          <View style={styles.sheetHandle} />
          <View style={styles.nutritionHeader}>
            <View>
              <AppText variant="subtitle" style={styles.nutritionTitle}>Chi tiết calo</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {post.caption || "Bài viết Daily Meal"}
              </AppText>
            </View>
            {total ? (
              <View style={styles.nutritionTotalPill}>
                <AppText style={styles.nutritionTotalText}>{Math.round(total.calories)} kcal</AppText>
              </View>
            ) : null}
          </View>

          {total ? (
            <View style={styles.macroRow}>
              <MacroPill label="Protein" value={`${Math.round(total.protein)}g`} />
              <MacroPill label="Carbs" value={`${Math.round(total.carbs)}g`} />
              <MacroPill label="Fat" value={`${Math.round(total.fat)}g`} />
            </View>
          ) : null}

          <ScrollView style={styles.nutritionScroll} showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.title} style={styles.nutritionSection}>
                <View style={styles.nutritionSectionHeader}>
                  <AppText variant="button">{section.title}</AppText>
                  {!section.hasDetails ? (
                    <AppText variant="caption" muted>Chưa có bảng thành phần</AppText>
                  ) : null}
                </View>

                <View style={styles.nutritionTable}>
                  <View style={[styles.nutritionTableRow, styles.nutritionTableHead]}>
                    <AppText style={[styles.nutritionCell, styles.ingredientCell]}>Thành phần</AppText>
                    <AppText style={[styles.nutritionCell, styles.portionCell]}>Định lượng</AppText>
                    <AppText style={styles.nutritionCell}>Calo</AppText>
                    <AppText style={styles.nutritionCell}>Protein</AppText>
                  </View>
                  {section.rows.map((row) => (
                    <View key={row.key} style={[styles.nutritionTableRow, row.isTotal && styles.nutritionTotalRow]}>
                      <AppText style={[styles.nutritionCell, styles.ingredientCell, row.isTotal && styles.nutritionStrongCell]}>
                        {row.ingredient}
                      </AppText>
                      <AppText style={[styles.nutritionCell, styles.portionCell]}>{row.portion}</AppText>
                      <AppText style={[styles.nutritionCell, row.isTotal && styles.nutritionStrongCell]}>{row.calories}</AppText>
                      <AppText style={[styles.nutritionCell, row.isTotal && styles.nutritionStrongCell]}>{row.protein}</AppText>
                    </View>
                  ))}
                </View>

                {section.warnings.length ? (
                  <AppText variant="caption" muted style={styles.nutritionWarning}>
                    {section.warnings.join(" ")}
                  </AppText>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macroPill}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText style={styles.macroValue}>{value}</AppText>
    </View>
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
    fontSize: 34,
    lineHeight: 42,
    color: colors.green,
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
    paddingTop: 30,
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 9
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4
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
    zIndex: 99,
    elevation: 15
  },
  authorChip: {
    marginTop: 16,
    alignSelf: "center",
    maxWidth: "86%",
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.green,
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 19
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
    paddingBottom: 35,
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
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 7,
    gap: 14
  },
  pillBtn: {
    width: 32,
    height: 32,
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
  nutritionSheet: {
    maxHeight: "86%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18
  },
  nutritionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14
  },
  nutritionTitle: {
    marginBottom: 4
  },
  nutritionTotalPill: {
    borderRadius: 16,
    backgroundColor: colors.green,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  nutritionTotalText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14
  },
  macroRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  macroPill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white
  },
  macroValue: {
    marginTop: 2,
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14
  },
  nutritionScroll: {
    maxHeight: 460
  },
  nutritionSection: {
    marginBottom: 18
  },
  nutritionSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  nutritionTable: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.black
  },
  nutritionTableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)"
  },
  nutritionTableHead: {
    borderTopWidth: 0,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  nutritionTotalRow: {
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  nutritionCell: {
    flex: 0.8,
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 7,
    paddingVertical: 9
  },
  ingredientCell: {
    flex: 1.05
  },
  portionCell: {
    flex: 1.18
  },
  nutritionStrongCell: {
    fontFamily: fonts.bold
  },
  nutritionWarning: {
    marginTop: 7
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
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.red,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.white
  },
  badgeText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 9
  }
});
