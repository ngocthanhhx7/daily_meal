import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
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
import { analytics, createEventThrottle } from "../services/analytics";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { MealSuitabilityInsight, Post, PostLayout } from "../types/api";
import {
  getExpandedPostTargetRect,
  getFallbackOriginRect,
  normalizeMeasuredRect,
  type MotionRect
} from "../utils/expandedPostMotion";
import { shouldStartFeedLoadMore } from "../utils/feedPagination";
import { getHomeTargetIndex, getPostViewerSets, mergeTargetPostIntoFeed } from "../utils/postNavigation";
import { DEFAULT_DOUBLE_TAP_THRESHOLD_MS, isDoubleTap, shouldLikeFromDoubleTap } from "../utils/tapGestures";
import { stickerImageSource } from "../utils/stickers";
import { formatNutritionDetailRows, getCaloriesOfCurrentImage } from "./postNutrition";
import { CameraIcon, CategoryIcon } from "../components/SvgIcons";
import { PostVideoPlayer } from "../components/PostVideoPlayer";

const PHONE_MAX_WIDTH = 383;
const ARTWORK_MAX_WIDTH = 380;
const ARTWORK_ASPECT_RATIO = 4 / 3; // 1.333 — 3:4 portrait cards (width:height)
const FEED_LOAD_MORE_COOLDOWN_MS = 900;

const DEMO_IMAGES = [
  require("../../assets/feed/home-food-back.png"),
  require("../../assets/feed/home-food-mid.png"),
  require("../../assets/feed/home-food-main.png")
];

const DEMO_STICKER = require("../../assets/feed/home-sticker.png");
const DEMO_AUTHOR_AVATAR = require("../../assets/feed/home-author.png");
const STREAK_BADGE = require("../../assets/feed/streak.png");
const PREMIUM_TRIAL_MASCOT = require("../../assets/stickers/b76f47fb-cc9c-41e7-ada3-39fc570671c9.jpg");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const HEART_RAIN_PARTICLES = [
  { x: -92, y: -118, scale: 0.95, rotate: "-24deg", duration: 900, delay: 0 },
  { x: -68, y: -152, scale: 0.78, rotate: "18deg", duration: 820, delay: 35 },
  { x: -36, y: -126, scale: 1.08, rotate: "-10deg", duration: 960, delay: 20 },
  { x: -12, y: -176, scale: 0.86, rotate: "28deg", duration: 880, delay: 65 },
  { x: 18, y: -136, scale: 1.16, rotate: "-18deg", duration: 930, delay: 10 },
  { x: 48, y: -166, scale: 0.82, rotate: "12deg", duration: 840, delay: 55 },
  { x: 76, y: -112, scale: 1, rotate: "24deg", duration: 920, delay: 30 },
  { x: 100, y: -146, scale: 0.72, rotate: "-30deg", duration: 860, delay: 80 },
  { x: -108, y: -76, scale: 0.66, rotate: "20deg", duration: 760, delay: 95 },
  { x: -54, y: -92, scale: 0.9, rotate: "-16deg", duration: 810, delay: 115 },
  { x: 0, y: -104, scale: 1.24, rotate: "0deg", duration: 940, delay: 45 },
  { x: 58, y: -88, scale: 0.92, rotate: "16deg", duration: 790, delay: 125 },
  { x: 112, y: -70, scale: 0.68, rotate: "-22deg", duration: 780, delay: 105 },
  { x: -24, y: -220, scale: 0.62, rotate: "26deg", duration: 980, delay: 135 },
  { x: 32, y: -214, scale: 0.7, rotate: "-14deg", duration: 1000, delay: 145 }
] as const;

type FeedImagePosition = {
  width: `${number}%`;
  height: `${number}%`;
  left: `${number}%`;
  top: `${number}%`;
  baseRotation: number;
};

type FeedImageFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
  zIndex: number;
};

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

function videoSource(post: Post) {
  const url = post.video?.url;
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:")) {
    return url;
  }
  return `${api.baseUrl}${url}`;
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

export function HomeScreen({ navigation, route }: any) {
  const { width: viewportWidth } = useWindowDimensions();
  const { token, user, claimPremiumTrial, refreshUser } = useAuth();
  const { socket } = useSocket();
  const { unreadCount } = useNotifications();
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [showCategory, setShowCategory] = useState(false);
  const [hideTrialMascot, setHideTrialMascot] = useState(false);
  const [isClaimingTrial, setIsClaimingTrial] = useState(false);
  const [showTrialOfferModal, setShowTrialOfferModal] = useState(false);
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [expandedPostOrigin, setExpandedPostOrigin] = useState<MotionRect | undefined>();
  const [spreadPostId, setSpreadPostId] = useState<string | null>(null);
  const [nutritionPost, setNutritionPost] = useState<Post | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const postsRef = useRef<Post[]>(posts);
  const currentIndexRef = useRef(currentIndex);
  const likedSetRef = useRef<Set<string>>(likedSet);
  const flatRef = useRef<FlatList>(null);
  const loadingMoreRef = useRef(false);
  const lastRequestedPageRef = useRef(1);
  const lastLoadMoreRequestAtRef = useRef(0);
  const lastLoadMoreTriggerIndexRef = useRef(-1);
  const isInitialMount = useRef(true);
  const clearingTargetParams = useRef(false);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const impressedPostIds = useRef<Set<string>>(new Set());
  const maxScrollDepthBucket = useRef(0);
  const scrollDepthThrottle = useRef(createEventThrottle(1500)).current;

  const closeExpandedPost = useCallback(() => {
    setExpandedPost(null);
    setExpandedPostOrigin(undefined);
  }, []);

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

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    setSpreadPostId(null);
  }, [currentIndex]);

  useEffect(() => {
    likedSetRef.current = likedSet;
  }, [likedSet]);

  const scrollFeedToTop = useCallback(() => {
    setCurrentIndex(0);
    requestAnimationFrame(() => {
      flatRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, []);

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

  const load = useCallback(async (jumpToTop = false, targetPostId?: string, targetPost?: Post) => {
    if (!token) return;
    try {
      const result = await api.feed(token, 1, 20);
      let feedPosts = result.posts.length ? result.posts : demoPosts;

      feedPosts = mergeTargetPostIntoFeed(feedPosts, targetPostId, targetPost);

      setPosts(feedPosts);
      setPage(1);
      setHasMore(result.posts.length >= 20);
      loadingMoreRef.current = false;
      lastRequestedPageRef.current = 1;
      lastLoadMoreRequestAtRef.current = 0;
      lastLoadMoreTriggerIndexRef.current = -1;

      const viewerSets = getPostViewerSets(feedPosts);
      likedSetRef.current = viewerSets.liked;
      setLikedSet(viewerSets.liked);
      setSavedSet(viewerSets.saved);

      if (targetPostId || jumpToTop) {
        scrollFeedToTop();
      }
    } catch {
      const fallbackPosts = mergeTargetPostIntoFeed(demoPosts, targetPostId, targetPost);
      setPosts(fallbackPosts);
      setPage(1);
      loadingMoreRef.current = false;
      lastRequestedPageRef.current = 1;
      lastLoadMoreRequestAtRef.current = 0;
      lastLoadMoreTriggerIndexRef.current = -1;
      const viewerSets = getPostViewerSets(fallbackPosts);
      likedSetRef.current = viewerSets.liked;
      setLikedSet(viewerSets.liked);
      setSavedSet(viewerSets.saved);
      setHasMore(false);
      if (targetPostId) {
        scrollFeedToTop();
      }
    }
  }, [scrollFeedToTop, token]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    const now = Date.now();
    const triggerIndex = currentIndexRef.current;

    if (!shouldStartFeedLoadMore({
      now,
      tokenPresent: Boolean(token),
      loading: loadingMoreRef.current,
      hasMore,
      isDemoFeed: posts === demoPosts,
      nextPage,
      lastRequestedPage: lastRequestedPageRef.current,
      lastRequestAt: lastLoadMoreRequestAtRef.current,
      cooldownMs: FEED_LOAD_MORE_COOLDOWN_MS,
      currentIndex: triggerIndex,
      lastTriggerIndex: lastLoadMoreTriggerIndexRef.current
    })) {
      return;
    }

    if (!token) return;

    loadingMoreRef.current = true;
    lastRequestedPageRef.current = nextPage;
    lastLoadMoreRequestAtRef.current = now;
    lastLoadMoreTriggerIndexRef.current = triggerIndex;
    setLoadingMore(true);
    try {
      const result = await api.feed(token, nextPage, 20);
      if (result.posts.length > 0) {
        setPosts((prevPosts) => {
          const existingIds = new Set(prevPosts.map((p) => p._id));
          const newPosts = result.posts.filter((p) => !existingIds.has(p._id));
          return [...prevPosts, ...newPosts];
        });

        // Update liked and saved sets from database viewerState for new posts
        setLikedSet((current) => {
          const next = new Set(current);
          result.posts.forEach((post) => {
            if (post.viewerState?.liked) {
              next.add(post._id);
            }
          });
          likedSetRef.current = next;
          return next;
        });

        setSavedSet((current) => {
          const next = new Set(current);
          result.posts.forEach((post) => {
            if (post.viewerState?.saved) {
              next.add(post._id);
            }
          });
          return next;
        });

        setPage(nextPage);
        setHasMore(result.posts.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more posts:", error);
      lastRequestedPageRef.current = page;
      lastLoadMoreTriggerIndexRef.current = Math.max(-1, triggerIndex - 1);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [token, page, hasMore, posts]);

  useFocusEffect(
    useCallback(() => {
      const targetPostId = route?.params?.postId;
      const targetPost = route?.params?.targetPost;

      if (clearingTargetParams.current && !targetPostId) {
        clearingTargetParams.current = false;
        return;
      }

      if (isInitialMount.current) {
        load(true, targetPostId, targetPost);
        isInitialMount.current = false;
      } else {
        load(false, targetPostId, targetPost);
      }
    }, [load, route?.params?.postId, route?.params?.targetPost])
  );

  useEffect(() => {
    const targetPostId = route?.params?.postId;
    if (listHeight > 0 && targetPostId && posts.length > 0) {
      const index = getHomeTargetIndex(posts, targetPostId);
      if (index !== -1) {
        setCurrentIndex(index);
        requestAnimationFrame(() => {
          if (index === 0) {
            flatRef.current?.scrollToOffset({ offset: 0, animated: false });
          } else {
            flatRef.current?.scrollToIndex({ index, animated: false });
          }
        });
        clearingTargetParams.current = true;
        navigation.setParams({ postId: undefined, targetPost: undefined });
      } else {
        clearingTargetParams.current = true;
        navigation.setParams({ postId: undefined, targetPost: undefined });
      }
    }
  }, [listHeight, route?.params?.postId, posts, navigation]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const currentPosts = postsRef.current;
    const first = viewableItems[0];
    if (first?.index != null) {
      currentIndexRef.current = first.index;
      setCurrentIndex(first.index);

      if (currentPosts.length > 0) {
        const depth = Math.round(((first.index + 1) / currentPosts.length) * 100);
        const bucket = Math.min(100, Math.max(25, Math.ceil(depth / 25) * 25));

        if (bucket > maxScrollDepthBucket.current && scrollDepthThrottle.shouldTrack("home_feed")) {
          maxScrollDepthBucket.current = bucket;
          analytics.track("feed_scroll_depth", {
            screen: "Home",
            value: bucket,
            properties: {
              index: first.index,
              totalPosts: currentPosts.length
            }
          });
        }
      }
    }

    viewableItems.forEach((item) => {
      const post = item.item as Post | undefined;
      if (!post || impressedPostIds.current.has(post._id)) {
        return;
      }

      impressedPostIds.current.add(post._id);
      analytics.track("feed_impression", {
        screen: "Home",
        entityType: "post",
        entityId: post._id,
        entityOwnerId: post.author?.id,
        properties: {
          index: item.index,
          imageCount: post.images.length,
          isDemo: post._id.startsWith("demo")
        }
      });
    });
  }).current;

  const currentPost = posts[currentIndex];
  const isLiked = currentPost ? likedSet.has(currentPost._id) : false;
  const isSaved = currentPost ? savedSet.has(currentPost._id) : false;
  const showDesktopFrame = viewportWidth >= 720 && isDesktopPointer();

  async function handleLike(targetPost = currentPost, mode: "toggle" | "likeOnly" = "toggle") {
    if (!token || !targetPost) return;
    const postId = targetPost._id;
    const isCurrentlyLiked = likedSetRef.current.has(postId);

    if (mode === "likeOnly" && !shouldLikeFromDoubleTap(isCurrentlyLiked)) {
      return;
    }

    // Optimistic UI updates
    const nextLikedSet = toggleSet(likedSetRef.current, postId);
    likedSetRef.current = nextLikedSet;
    setLikedSet(nextLikedSet);
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
      const revertedLikedSet = toggleSet(likedSetRef.current, postId);
      likedSetRef.current = revertedLikedSet;
      setLikedSet(revertedLikedSet);
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
    analytics.track("feed_comment_click", {
      screen: "Home",
      entityType: "post",
      entityId: currentPost._id,
      entityOwnerId: currentPost.author?.id
    });
    navigation.navigate("Comments", { post: currentPost });
  }

  const shouldShowTrialMascot = Boolean(
    user?.preferences.completedOnboarding &&
    !user.isPremium &&
    !user.premiumTrialUsed &&
    !hideTrialMascot
  );

  async function claimTrialOffer() {
    analytics.track("premium_trial_accept", { screen: "Home" });
    try {
      setIsClaimingTrial(true);
      await claimPremiumTrial();
      analytics.track("premium_trial_claimed", { screen: "Home" });
      setHideTrialMascot(true);
      setShowTrialOfferModal(false);
      Alert.alert("Đã nâng Premium!", "Premium miễn phí 1 tháng đã được kích hoạt cho bạn.");
    } catch (error: any) {
      analytics.track("premium_trial_failed", {
        screen: "Home",
        properties: {
          message: error?.message ?? "unknown"
        }
      });
      Alert.alert("Chưa nhận được quà", error?.message || "Vui lòng thử lại sau nhé.");
      await refreshUser();
    } finally {
      setIsClaimingTrial(false);
    }
  }

  function handlePremiumTrialPress() {
    if (isClaimingTrial) {
      return;
    }

    setShowTrialOfferModal(true);
    analytics.track("premium_trial_offer_opened", { screen: "Home" });
  }

  function handleDeclineTrialOffer() {
    analytics.track("premium_trial_declined", { screen: "Home" });
    setShowTrialOfferModal(false);
    setHideTrialMascot(true);
  }

  return (
    <FigmaLineBackground>
      <SafeAreaView style={[styles.safe, showDesktopFrame && styles.phoneFrame]} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <AppText style={styles.headerTitle}>Bảng tin</AppText>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => {
                analytics.track("notification_click", { screen: "Home" });
                navigation.navigate("Notifications");
              }}
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
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => {
                analytics.track("profile_click", {
                  screen: "Home",
                  entityType: "user",
                  entityId: user?.id
                });
                navigation.navigate("Profile");
              }}
              hitSlop={8}
            >
              <Ionicons name="person" size={30} color={colors.black} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.feedWrap}
          onLayout={(event) => {
            const { height, width } = event.nativeEvent.layout;
            if (height > 0 && width > 0) {
              setListHeight(height);
              setListWidth(width);
            }
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
                  isLiked={likedSet.has(item._id)}
                  videoActive={index === currentIndex}
                  shouldRenderVideo={Math.abs(index - currentIndex) <= 1}
                  spreadOpen={spreadPostId === item._id}
                  onPress={(originRect) => {
                    analytics.track("feed_detail_click", {
                      screen: "Home",
                      entityType: "post",
                      entityId: item._id,
                      entityOwnerId: item.author?.id,
                      properties: { index }
                    });
                    if (item.mediaType !== "video" && item.images.length > 1) {
                      setExpandedPost(null);
                      setExpandedPostOrigin(undefined);
                      setSpreadPostId((current) => current === item._id ? null : item._id);
                      return;
                    }

                    if (item.mediaType !== "video") {
                      setExpandedPost(null);
                      setExpandedPostOrigin(undefined);
                      setSpreadPostId(null);
                      return;
                    }

                    setSpreadPostId(null);
                    setExpandedPostOrigin(originRect);
                    setExpandedPost(item);
                  }}
                  onDoubleLike={() => {
                    void handleLike(item, "likeOnly");
                  }}
                  onNutritionPress={() => {
                    analytics.track("feed_nutrition_click", {
                      screen: "Home",
                      entityType: "post",
                      entityId: item._id,
                      entityOwnerId: item.author?.id,
                      properties: { index }
                    });
                    setNutritionPost(item);
                  }}
                  onRecipePress={() => {
                    analytics.track("feed_recipe_click", {
                      screen: "Home",
                      entityType: "post",
                      entityId: item._id,
                      entityOwnerId: item.author?.id,
                      properties: { index }
                    });
                    navigation.navigate("Recipe", { post: item });
                  }}
                  onAuthorPress={() => {
                    analytics.track("profile_click", {
                      screen: "Home",
                      entityType: "user",
                      entityId: item.author?.id,
                      properties: {
                        source: "feed_author",
                        postId: item._id
                      }
                    });
                    if (!item._id.startsWith("demo") && item.author?.id) {
                      navigation.navigate("PublicProfile", { userId: item.author.id });
                    } else {
                      navigation.navigate("Profile");
                    }
                  }}
                  shouldShowTrialMascot={shouldShowTrialMascot}
                  onPremiumTicketPress={handlePremiumTrialPress}
                />
              )}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={5}
              updateCellsBatchingPeriod={80}
              removeClippedSubviews={Platform.OS !== "web"}
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
              extraData={{ currentIndex, spreadPostId, likedSet, savedSet }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
            />
          ) : null}
        </View>

        {/* Mascot replaced by ticket inside PostSlide */}

        <FadeSlideIn delay={200} slideDistance={20} duration={500}>
          <View style={[styles.bottomBar, showDesktopFrame && styles.desktopBottomBar]}>
            <BouncePress
              style={styles.squareBtn}
              onPress={() => {
                analytics.track("feed_category_menu_opened", { screen: "Home" });
                setShowCategory(true);
              }}
              hitSlop={6}
            >
              <CategoryIcon size={30} color={colors.black} />
            </BouncePress>

            <View style={styles.actionPill}>
              <BouncePress style={styles.pillBtn} onPress={handleComment} hitSlop={4}>
                <Ionicons name="chatbubble" size={26} color={colors.white} />
              </BouncePress>
              <Pressable style={styles.pillBtn} onPress={() => { bounceHeart(); handleLike(); }} hitSlop={4}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? colors.red : colors.white} />
                </Animated.View>
              </Pressable>
              <Pressable style={styles.pillBtn} onPress={() => { bounceSave(); handleSave(); }} hitSlop={4}>
                <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                  <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={27} color={isSaved ? colors.yellow : colors.white} />
                </Animated.View>
              </Pressable>
            </View>

            <BouncePress
              style={styles.squareBtn}
              onPress={() => {
                analytics.track("create_post_entry_click", {
                  screen: "Home",
                  properties: { source: "home_bottom_bar" }
                });
                navigation.navigate("Create");
              }}
              hitSlop={6}
            >
              <CameraIcon size={30} color={colors.black} />
            </BouncePress>
          </View>
        </FadeSlideIn>

        <ExpandedPostModal
          post={expandedPost}
          originRect={expandedPostOrigin}
          onClose={closeExpandedPost}
          onRecipePress={() => {
            const post = expandedPost;
            closeExpandedPost();
            if (post) {
              analytics.track("detail_recipe_click", {
                screen: "Home",
                entityType: "post",
                entityId: post._id,
                entityOwnerId: post.author?.id
              });
              navigation.navigate("Recipe", { post });
            }
          }}
          onCommentPress={() => {
            const post = expandedPost;
            closeExpandedPost();
            if (post) {
              analytics.track("detail_comment_click", {
                screen: "Home",
                entityType: "post",
                entityId: post._id,
                entityOwnerId: post.author?.id
              });
              navigation.navigate("Comments", { post });
            }
          }}
          onAuthorPress={() => {
            const post = expandedPost;
            closeExpandedPost();
            analytics.track("profile_click", {
              screen: "Home",
              entityType: "user",
              entityId: post?.author?.id,
              properties: {
                source: "post_detail",
                postId: post?._id
              }
            });
            if (post && !post._id.startsWith("demo") && post.author?.id) {
              navigation.navigate("PublicProfile", { userId: post.author.id });
            } else {
              navigation.navigate("Profile");
            }
          }}
        />

        <NutritionDetailModal post={nutritionPost} token={token} onClose={() => setNutritionPost(null)} />

        <CategoryModal
          visible={showCategory}
          onClose={() => setShowCategory(false)}
          onNavigate={(screen) => {
            setShowCategory(false);
            analytics.track("feed_category_nav_click", {
              screen: "Home",
              properties: { destination: screen }
            });
            setTimeout(() => navigation.navigate(screen), 0);
          }}
        />

        <PremiumTrialOfferModal
          visible={showTrialOfferModal}
          isClaiming={isClaimingTrial}
          onAccept={() => {
            void claimTrialOffer();
          }}
          onDecline={handleDeclineTrialOffer}
          onClose={() => setShowTrialOfferModal(false)}
        />
      </SafeAreaView>
    </FigmaLineBackground>
  );
}

const TRIAL_MASCOT_LINES = [
  "Bạn ơi, có quà Premium nè!",
  "Thử 1 tháng VIP miễn phí nha!",
  "Nhận quà để nấu ngon hơn nào!",
  "Miu đầu bếp đang đợi bạn đó!"
];

function PremiumTrialOfferModal({
  visible,
  isClaiming,
  onAccept,
  onDecline,
  onClose
}: {
  visible: boolean;
  isClaiming: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.trialOfferOverlay}>
        <Pressable style={styles.trialOfferBackdrop} onPress={onClose} />
        <View style={styles.trialOfferCard}>
          <View style={styles.trialOfferIconWrap}>
            <Image
              source={require("../../assets/feed/Group.png")}
              style={[styles.trialOfferIcon, { width: 100, height: 54 }]}
              resizeMode="contain"
            />
          </View>
          <AppText style={styles.trialOfferTitle}>{"Nhận 1 tháng Premium miễn phí?"}</AppText>
          <AppText style={styles.trialOfferMessage}>{"Bạn chưa sử dụng ưu đãi lần đầu. Nâng lên Premium ngay để trải nghiệm đầy đủ tính năng Daily Meal trong 1 tháng."}</AppText>
          <View style={styles.trialOfferPerks}>
            <AppText style={styles.trialOfferPerk}>{"• Đăng nhiều ảnh hơn"}</AppText>
            <AppText style={styles.trialOfferPerk}>{"• Dùng sticker Premium"}</AppText>
            <AppText style={styles.trialOfferPerk}>{"• Trải nghiệm các quyền lợi VIP"}</AppText>
          </View>
          <View style={styles.trialOfferActions}>
            <Pressable style={styles.trialOfferSecondaryButton} onPress={onDecline} disabled={isClaiming}>
              <AppText style={styles.trialOfferSecondaryText}>{"Để sau"}</AppText>
            </Pressable>
            <Pressable style={styles.trialOfferPrimaryButton} onPress={onAccept} disabled={isClaiming}>
              <AppText style={styles.trialOfferPrimaryText}>{isClaiming ? "Đang nâng..." : "Nâng Premium"}</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PremiumTrialMascot({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const walk = useRef(new Animated.Value(0)).current;
  const step = useRef(new Animated.Value(0)).current;
  const bubblePulse = useRef(new Animated.Value(0)).current;
  const [lineIndex, setLineIndex] = useState(0);
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const mascotWobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const walkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(walk, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    const stepAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(step, {
          toValue: 1,
          duration: 360,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(step, {
          toValue: 0,
          duration: 360,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    const bubbleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bubblePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(bubblePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(mascotFloat, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    const wobbleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotWobble, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(mascotWobble, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    const lineTimer = setInterval(() => {
      setLineIndex((current) => (current + 1) % TRIAL_MASCOT_LINES.length);
    }, 2600);

    walkAnimation.start();
    stepAnimation.start();
    bubbleAnimation.start();
    floatAnimation.start();
    wobbleAnimation.start();

    return () => {
      walkAnimation.stop();
      stepAnimation.stop();
      bubbleAnimation.stop();
      floatAnimation.stop();
      wobbleAnimation.stop();
      clearInterval(lineTimer);
    };
  }, [bubblePulse, mascotFloat, mascotWobble, step, walk]);

  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const bobY = step.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const bodyRotate = step.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  const faceDirection = walk.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, -1] });
  const bubbleScale = bubblePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const floatLift = mascotFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const wobbleRotate = mascotWobble.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "4deg"] });

  return (
    <Animated.View style={[styles.trialMascotRail, { transform: [{ translateX }] }]} pointerEvents="box-none">
      <Pressable style={styles.trialMascotButton} onPress={onPress} disabled={disabled} hitSlop={{ top: 18, bottom: 18, left: 28, right: 28 }}>
        <Animated.View style={[styles.trialSpeechBubble, { transform: [{ scale: bubbleScale }] }]}>
          <AppText style={styles.trialSpeechText}>{TRIAL_MASCOT_LINES[lineIndex]}</AppText>
          <View style={styles.trialSpeechTail} />
        </Animated.View>
        <Animated.View style={[styles.trialModelWrap, { transform: [{ translateY: bobY }, { rotate: bodyRotate }, { scaleX: faceDirection }, { translateY: floatLift }, { rotate: wobbleRotate }] }]}>
          <Animated.View style={[styles.trialSpriteGlow, { opacity: bubblePulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }) }]} />
          <Animated.Image
            source={require("../../assets/stickers/b76f47fb-cc9c-41e7-ada3-39fc570671c9-cutout.png")}
            style={styles.trialMascotCutout}
            resizeMode="contain"
          />
          <View style={styles.trialSparkleLeft} />
          <View style={styles.trialSparkleRight} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function FeedAuthorChip({
  post,
  onAuthorPress,
  expanded = false
}: {
  post: Post;
  onAuthorPress: () => void;
  expanded?: boolean;
}) {
  const streakDays = post.author?.streakDays ?? 0;
  const showStreak = streakDays >= 3;
  const chipWrapStyle = expanded ? expandedStyles.authorChipWrap : styles.authorChipWrap;
  const chipWrapWithStreakStyle = expanded ? expandedStyles.authorChipWrapWithStreak : styles.authorChipWrapWithStreak;
  const chipStyle = expanded ? expandedStyles.authorChip : styles.authorChip;
  const avatarStyle = expanded ? expandedStyles.authorAvatar : styles.authorAvatar;
  const avatarImageStyle = expanded ? expandedStyles.authorAvatarImg : styles.authorAvatarImage;
  const avatarTextStyle = expanded ? expandedStyles.authorInitial : styles.authorAvatarText;
  const nameStyle = expanded ? expandedStyles.authorName : styles.authorName;
  const streakBadgeStyle = expanded ? expandedStyles.authorStreakBadge : styles.authorStreakBadge;
  const streakImageStyle = expanded ? expandedStyles.authorStreakImage : styles.authorStreakImage;
  const streakCountWrapStyle = expanded ? expandedStyles.authorStreakCountWrap : styles.authorStreakCountWrap;
  const streakCountTextStyle = expanded ? expandedStyles.authorStreakCountText : styles.authorStreakCountText;

  return (
    <View style={[chipWrapStyle, showStreak && chipWrapWithStreakStyle]}>
      {showStreak ? (
        <View style={streakBadgeStyle} pointerEvents="none">
          <Image source={STREAK_BADGE} style={streakImageStyle} resizeMode="contain" />
        </View>
      ) : null}
      {showStreak ? (
        <View style={streakCountWrapStyle} pointerEvents="none">
          <AppText style={streakCountTextStyle}>{streakDays}</AppText>
        </View>
      ) : null}
      <Pressable
        style={[
          chipStyle,
          { backgroundColor: post.author?.themeColor || colors.green }
        ]}
        onPress={onAuthorPress}
      >
        <View style={avatarStyle}>
          {post.author?.avatarUrl ? (
            <Image
              source={authorAvatarSource(post.author.avatarUrl)}
              style={avatarImageStyle}
              resizeMode="cover"
            />
          ) : post._id.startsWith("demo") ? (
            <Image source={DEMO_AUTHOR_AVATAR} style={avatarImageStyle} resizeMode="cover" />
          ) : (
            <AppText style={[avatarTextStyle, { color: post.author?.themeColor || colors.green }]}>
              {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
            </AppText>
          )}
        </View>
        <AppText style={nameStyle} numberOfLines={1}>
          {post.author?.displayName ?? "Daily Meal"}
        </AppText>
      </Pressable>
    </View>
  );
}

const PostSlide = React.memo(function PostSlide({
  post,
  index,
  slideHeight,
  slideWidth,
  isLiked,
  videoActive,
  shouldRenderVideo,
  spreadOpen = false,
  onPress,
  onDoubleLike,
  onNutritionPress,
  onRecipePress,
  onAuthorPress,
  shouldShowTrialMascot,
  onPremiumTicketPress
}: {
  post: Post;
  index: number;
  slideHeight: number;
  slideWidth: number;
  isLiked: boolean;
  videoActive: boolean;
  shouldRenderVideo: boolean;
  spreadOpen?: boolean;
  onPress: (originRect?: MotionRect) => void;
  onDoubleLike: () => void;
  onNutritionPress: () => void;
  onRecipePress: () => void;
  onAuthorPress: () => void;
  shouldShowTrialMascot?: boolean;
  onPremiumTicketPress?: () => void;
}) {
  const artworkWidth = Math.min(Math.max(slideWidth - 36, 280), ARTWORK_MAX_WIDTH);
  const artworkHeight = Math.min(Math.round(artworkWidth * ARTWORK_ASPECT_RATIO), Math.max(slideHeight - 130, 320));
  const artworkRef = useRef<View>(null);
  const lastArtworkTapRef = useRef<number | undefined>(undefined);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextHeartBurstRef = useRef(0);
  const spreadProgress = useRef(new Animated.Value(0)).current;
  const [heartRainBursts, setHeartRainBursts] = useState<number[]>([]);
  const caloriesOfCurrentImage = getCaloriesOfCurrentImage(post, previewImageIndex(post));

  useEffect(() => {
    Animated.timing(spreadProgress, {
      toValue: spreadOpen ? 1 : 0,
      duration: spreadOpen ? 360 : 230,
      easing: spreadOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [spreadOpen, spreadProgress]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  function openArtworkDetail() {
    const measuredView = artworkRef.current as unknown as {
      measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
    };

    if (!measuredView?.measureInWindow) {
      onPress();
      return;
    }

    measuredView.measureInWindow((x, y, width, height) => {
      onPress(normalizeMeasuredRect({ x, y, width, height }));
    });
  }

  const triggerHeartRain = useCallback(() => {
    const burstId = nextHeartBurstRef.current;
    nextHeartBurstRef.current += 1;
    setHeartRainBursts((current) => [...current, burstId]);
  }, []);

  const handleHeartBurstComplete = useCallback((burstId: number) => {
    setHeartRainBursts((current) => current.filter((id) => id !== burstId));
  }, []);

  function handleArtworkPress() {
    const now = Date.now();

    if (isDoubleTap(lastArtworkTapRef.current, now)) {
      lastArtworkTapRef.current = undefined;

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = undefined;
      }

      if (shouldLikeFromDoubleTap(isLiked)) {
        onDoubleLike();
      }
      triggerHeartRain();
      return;
    }

    lastArtworkTapRef.current = now;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }

    singleTapTimerRef.current = setTimeout(() => {
      lastArtworkTapRef.current = undefined;
      singleTapTimerRef.current = undefined;
      openArtworkDetail();
    }, DEFAULT_DOUBLE_TAP_THRESHOLD_MS);
  }

  const artworkRotate = spreadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardRotation(index), "0deg"]
  });
  const imageLimit = Math.min(Math.max(post.images.length, 1), 4);
  const canSpreadChips = post.mediaType !== "video" && imageLimit > 1;
  const topLeftFrame = canSpreadChips ? spreadFeedImageFrame(imageLimit, 0, artworkWidth, artworkHeight) : null;
  const topRightFrame = canSpreadChips ? spreadFeedImageFrame(imageLimit, 1, artworkWidth, artworkHeight) : null;
  const recipeSourceTop = shouldShowTrialMascot ? 75 : 24;
  const chipHeight = 44;
  const chipGap = 6;
  const stackedChipGap = 10;
  const recipeChipMotionStyle = topLeftFrame
    ? {
        left: spreadProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, topLeftFrame.left]
        }),
        top: spreadProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [recipeSourceTop, Math.max(0, topLeftFrame.top - chipHeight - chipGap)]
        })
      }
    : null;
  const statsChipMotionStyle = topRightFrame
    ? {
        right: Math.max(0, artworkWidth - (topRightFrame.left + topRightFrame.width)),
        top: spreadProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            22,
            Math.max(0, topRightFrame.top - chipHeight - (caloriesOfCurrentImage ? chipHeight + chipGap + stackedChipGap : chipGap))
          ]
        })
      }
    : null;
  const caloBadgeMotionStyle = topRightFrame
    ? {
        right: Math.max(0, artworkWidth - (topRightFrame.left + topRightFrame.width)),
        top: spreadProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [76, Math.max(0, topRightFrame.top - chipHeight - chipGap)]
        })
      }
    : null;

  return (
    <View style={[styles.slide, { height: slideHeight }]}>
      <Pressable style={[styles.artworkPress, { width: artworkWidth, height: artworkHeight }]} onPress={handleArtworkPress}>
        <Animated.View ref={artworkRef} collapsable={false} style={[styles.feedArtwork, { transform: [{ rotate: artworkRotate }] }]}>
          <FeedArtwork
            post={post}
            videoActive={videoActive}
            shouldRenderVideo={shouldRenderVideo}
            spreadOpen={spreadOpen}
            spreadProgress={spreadProgress}
            canvasWidth={artworkWidth}
            canvasHeight={artworkHeight}
          />

          {shouldShowTrialMascot && (
            <Pressable
              style={styles.premiumTicket}
              onPress={(event) => {
                event.stopPropagation();
                onPremiumTicketPress?.();
              }}
            >
              <Image
                source={require("../../assets/feed/Group.png")}
                style={styles.premiumTicketImage}
                resizeMode="contain"
              />
            </Pressable>
          )}

          {(post.recipe?.title || post.recipe?.ingredients?.length || (post.recipes && post.recipes.length > 0)) ? (
            <AnimatedPressable
              style={[styles.recipeChip, shouldShowTrialMascot && { top: 75 }, recipeChipMotionStyle]}
              onPress={(event) => {
                event.stopPropagation();
                onRecipePress();
              }}
            >
              <AppText style={styles.recipeChipText}>Công thức</AppText>
            </AnimatedPressable>
          ) : null}

          <Animated.View style={[styles.statsChip, statsChipMotionStyle]}>
            <AppText style={styles.statsNum}>{Math.max(0, post.stats?.comments ?? 0)}</AppText>
            <Ionicons name="chatbubble-outline" size={15} color={colors.black} />
            <AppText style={styles.statsNum}>{Math.max(0, post.stats?.likes ?? 0)}</AppText>
            <Ionicons name="heart" size={15} color={colors.red} />
          </Animated.View>

          {caloriesOfCurrentImage ? (
            <CalorieActionBadge
              calories={caloriesOfCurrentImage}
              style={caloBadgeMotionStyle}
              onPress={onNutritionPress}
            />
          ) : null}

          <View style={styles.captionChip}>
            <Ionicons name="location" size={17} color={colors.black} />
            <AppText numberOfLines={1} style={styles.captionText}>
              {post.caption || "Nó ngon phải biết"}
            </AppText>
          </View>

          <HeartRainOverlay bursts={heartRainBursts} onBurstComplete={handleHeartBurstComplete} />
        </Animated.View>
      </Pressable>

      <FeedAuthorChip post={post} onAuthorPress={onAuthorPress} />
    </View>
  );
});

function CalorieActionBadge({
  calories,
  style,
  onPress
}: {
  calories: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const wobble = useRef(new Animated.Value(0)).current;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const textTimer = setInterval(() => {
      setShowHint((current) => !current);
    }, 2000);
    const wobbleAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(1280),
        Animated.timing(wobble, {
          toValue: 1,
          duration: 70,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(wobble, {
          toValue: -1,
          duration: 90,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(wobble, {
          toValue: 0.6,
          duration: 80,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(wobble, {
          toValue: 0,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    wobbleAnimation.start();

    return () => {
      clearInterval(textTimer);
      wobbleAnimation.stop();
    };
  }, [wobble]);

  const translateX = wobble.interpolate({
    inputRange: [-1, 1],
    outputRange: [-2.5, 2.5]
  });
  const rotate = wobble.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-1.6deg", "1.6deg"]
  });
  const badgeBackgroundColor = calories < 500 ? "#8BA58A" : colors.red;
  const badgeLabel = showHint ? "chạm để xem calo" : `${Math.round(calories)} Calo`;

  return (
    <AnimatedPressable
      style={[
        styles.caloBadge,
        style,
        {
          backgroundColor: badgeBackgroundColor,
          transform: [
            { translateX },
            { rotate }
          ]
        }
      ]}
      onPress={onPress}
      hitSlop={6}
    >
      <AppText numberOfLines={1} style={[styles.caloText, showHint && styles.caloHintText]}>
        {badgeLabel}
      </AppText>
      <AppText numberOfLines={showHint ? 2 : 1} style={[{ display: "none" }, styles.caloText, showHint && styles.caloHintText]}>
        {showHint ? "chạm vào đây để xem lượng calo" : `${Math.round(calories)} Calo`}
      </AppText>
    </AnimatedPressable>
  );
}

function FeedArtwork({
  post,
  videoActive = true,
  shouldRenderVideo = true,
  spreadOpen = false,
  spreadProgress,
  canvasWidth,
  canvasHeight
}: {
  post: Post;
  videoActive?: boolean;
  shouldRenderVideo?: boolean;
  spreadOpen?: boolean;
  spreadProgress?: Animated.Value;
  canvasWidth?: number;
  canvasHeight?: number;
}) {
  const imageCount = Math.max(post.images.length, 1);
  const visibleImageCount = Math.min(imageCount, 4);
  const layout = post.layout ?? "stack";
  const stickerSource = stickerImageSource(post.stickerId) ?? (post._id.startsWith("demo") ? DEMO_STICKER : null);
  const placement = post.stickerPlacement ?? { x: 0.78, y: 0.78, scale: 1, rotation: 0 };
  const imageLoadStartedAt = useRef<Record<number, number>>({});
  const reportedImageLoads = useRef<Set<number>>(new Set());

  if (post.mediaType === "video" && videoSource(post) && shouldRenderVideo) {
    const position = feedImagePosition("stack", 1, 0);
    return (
      <View style={styles.feedArtworkCanvas}>
        <View style={[styles.feedImageWrap, position, { zIndex: 10 }]}>
          <PostVideoPlayer
            uri={videoSource(post)!}
            active={videoActive}
            style={styles.feedImage}
            showBadge={false}
          />
        </View>
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

  return (
    <View style={styles.feedArtworkCanvas}>
      {Array.from({ length: visibleImageCount }).map((_, index) => {
        const transform = post.imageTransforms?.[index] ?? {
          scale: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0
        };
        const { baseRotation, ...position } = feedImagePosition(layout, imageCount, index);
        const canAnimateSpread = !!spreadProgress && !!canvasWidth && !!canvasHeight && visibleImageCount > 1;
        const sourceFrame = canAnimateSpread
          ? feedImageFrame(layout, imageCount, index, canvasWidth!, canvasHeight!)
          : null;
        const targetFrame = canAnimateSpread
          ? spreadFeedImageFrame(visibleImageCount, index, canvasWidth!, canvasHeight!)
          : null;
        const frameStyle = canAnimateSpread && sourceFrame && targetFrame
          ? animatedFeedImageFrame(spreadProgress!, sourceFrame, targetFrame)
          : position;
        const translateX = canAnimateSpread
          ? spreadProgress!.interpolate({
              inputRange: [0, 1],
              outputRange: [transform.offsetX * 0.35, 0]
            })
          : transform.offsetX * 0.35;
        const translateY = canAnimateSpread
          ? spreadProgress!.interpolate({
              inputRange: [0, 1],
              outputRange: [transform.offsetY * 0.35, 0]
            })
          : transform.offsetY * 0.35;
        const rotate = canAnimateSpread
          ? spreadProgress!.interpolate({
              inputRange: [0, 1],
              outputRange: [`${baseRotation + transform.rotation}deg`, "0deg"]
            })
          : `${baseRotation + transform.rotation}deg`;
        const scale = canAnimateSpread
          ? spreadProgress!.interpolate({
              inputRange: [0, 1],
              outputRange: [transform.scale, 1]
            })
          : transform.scale;

        return (
          <Animated.View
            key={`${post._id}-${index}`}
            style={[
              styles.feedImageWrap,
              frameStyle,
              {
                zIndex: spreadOpen && targetFrame ? targetFrame.zIndex : 10 + index,
                elevation: spreadOpen && targetFrame ? targetFrame.zIndex : 10 + index,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { scale }
                ]
              }
            ]}
          >
            <Image
              source={imageSource(post, index)}
              style={styles.feedImage}
              resizeMode="cover"
              onLoadStart={() => {
                imageLoadStartedAt.current[index] = Date.now();
              }}
              onLoadEnd={() => {
                if (reportedImageLoads.current.has(index)) {
                  return;
                }

                reportedImageLoads.current.add(index);
                analytics.track("image_load", {
                  screen: "Home",
                  entityType: "post_image",
                  entityId: post.images[index]?.uploadId ?? `${post._id}:${index}`,
                  entityOwnerId: post.author?.id,
                  durationMs: Math.max(0, Date.now() - (imageLoadStartedAt.current[index] ?? Date.now())),
                  properties: {
                    postId: post._id,
                    imageIndex: index,
                    source: "feed"
                  }
                });
              }}
              onError={() => {
                analytics.track("image_load_error", {
                  screen: "Home",
                  entityType: "post_image",
                  entityId: post.images[index]?.uploadId ?? `${post._id}:${index}`,
                  entityOwnerId: post.author?.id,
                  properties: {
                    postId: post._id,
                    imageIndex: index,
                    source: "feed"
                  }
                });
              }}
            />
          </Animated.View>
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

function HeartRainOverlay({
  bursts,
  onBurstComplete
}: {
  bursts: number[];
  onBurstComplete: (burstId: number) => void;
}) {
  if (!bursts.length) {
    return null;
  }

  return (
    <View style={styles.heartRainLayer}>
      {bursts.map((burstId) => (
        <HeartRainBurst key={burstId} burstId={burstId} onComplete={onBurstComplete} />
      ))}
    </View>
  );
}

function HeartRainBurst({
  burstId,
  onComplete
}: {
  burstId: number;
  onComplete: (burstId: number) => void;
}) {
  const particles = useRef(
    HEART_RAIN_PARTICLES.map((spec) => ({
      spec,
      progress: new Animated.Value(0)
    }))
  ).current;

  useEffect(() => {
    const animations = particles.map(({ progress, spec }) =>
      Animated.timing(progress, {
        toValue: 1,
        duration: spec.duration,
        delay: spec.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    );

    Animated.parallel(animations).start(({ finished }) => {
      if (finished) {
        onComplete(burstId);
      }
    });

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [burstId, onComplete, particles]);

  return (
    <>
      {particles.map(({ progress, spec }, index) => {
        const opacity = progress.interpolate({
          inputRange: [0, 0.16, 0.78, 1],
          outputRange: [0, 1, 1, 0]
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.x]
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.y]
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.18, 1],
          outputRange: [0.35, spec.scale, 0.72]
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", spec.rotate]
        });

        return (
          <Animated.View
            key={`${burstId}-${index}`}
            style={[
              styles.heartRainHeart,
              {
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate }
                ]
              }
            ]}
          >
            <Ionicons name="heart" size={22} color={index % 3 === 0 ? "#FF7AA2" : colors.red} />
          </Animated.View>
        );
      })}
    </>
  );
}

function percentToPixels(value: string, total: number) {
  return (Number.parseFloat(value) / 100) * total;
}

function feedImageFrame(layout: PostLayout, count: number, index: number, canvasWidth: number, canvasHeight: number): FeedImageFrame {
  const position = feedImagePosition(layout, count, index);

  return {
    left: percentToPixels(position.left, canvasWidth),
    top: percentToPixels(position.top, canvasHeight),
    width: percentToPixels(position.width, canvasWidth),
    height: percentToPixels(position.height, canvasHeight),
    rotate: position.baseRotation,
    zIndex: 10 + index
  };
}

function spreadFeedImageFrame(count: number, index: number, canvasWidth: number, canvasHeight: number): FeedImageFrame {
  const imageLimit = Math.min(Math.max(count, 1), 4);
  const sidePad = 0;
  const gap = Math.max(10, canvasWidth * 0.032);
  const innerWidth = canvasWidth - sidePad * 2;
  const columnWidth = (innerWidth - gap) / 2;

  if (imageLimit === 2) {
    const imageHeight = Math.min(canvasHeight * 0.62, columnWidth * 1.58);
    const frames = [
      {
        left: sidePad,
        top: Math.min(canvasHeight - imageHeight - 48, canvasHeight * 0.32),
        width: columnWidth,
        height: imageHeight,
        rotate: 0,
        zIndex: 24
      },
      {
        left: sidePad + columnWidth + gap,
        top: canvasHeight * 0.22,
        width: columnWidth,
        height: imageHeight,
        rotate: 0,
        zIndex: 26
      }
    ];

    return frames[index] ?? frames[0]!;
  }

  if (imageLimit === 3) {
    const top = canvasHeight * 0.15;
    const heroWidth = innerWidth * 0.56;
    const rightWidth = innerWidth - heroWidth - gap;
    const heroHeight = Math.min(canvasHeight * 0.44, heroWidth * 1.08);
    const rightHeight = Math.min(canvasHeight * 0.4, rightWidth * 1.28);
    const bottomWidth = Math.min(heroWidth * 0.64, innerWidth * 0.38);
    const bottomHeight = Math.min(canvasHeight - (top + heroHeight + gap) - 24, bottomWidth * 1.32);
    const frames = [
      {
        left: sidePad,
        top,
        width: heroWidth,
        height: heroHeight,
        rotate: 0,
        zIndex: 24
      },
      {
        left: sidePad + heroWidth + gap,
        top: top + heroHeight * 0.5,
        width: rightWidth,
        height: rightHeight,
        rotate: 0,
        zIndex: 26
      },
      {
        left: sidePad + heroWidth * 0.35,
        top: top + heroHeight + gap,
        width: bottomWidth,
        height: bottomHeight,
        rotate: 0,
        zIndex: 22
      }
    ];

    return frames[index] ?? frames[0]!;
  }

  const leftWidth = innerWidth * 0.53;
  const rightWidth = innerWidth - leftWidth - gap;
  const topLeft = canvasHeight * 0.2;
  const topRight = canvasHeight * 0.2;
  const leftHeroHeight = Math.min(canvasHeight * 0.42, leftWidth * 1.08);
  const rightHeroHeight = Math.min(canvasHeight * 0.48, rightWidth * 1.48);
  const bottomLeftWidth = leftWidth * 0.72;
  const bottomLeftHeight = Math.min(canvasHeight * 0.27, bottomLeftWidth * 1.12);
  const bottomRightWidth = rightWidth * 0.72;
  const bottomRightHeight = Math.min(canvasHeight * 0.26, bottomRightWidth * 1.2);
  const frames = [
    {
      left: sidePad,
      top: topLeft,
      width: leftWidth,
      height: leftHeroHeight,
      rotate: 0,
      zIndex: 24
    },
    {
      left: sidePad + leftWidth + gap,
      top: topRight,
      width: rightWidth,
      height: rightHeroHeight,
      rotate: 0,
      zIndex: 26
    },
    {
      left: sidePad + leftWidth * 0.28,
      top: topLeft + leftHeroHeight + gap,
      width: bottomLeftWidth,
      height: bottomLeftHeight,
      rotate: 0,
      zIndex: 22
    },
    {
      left: sidePad + leftWidth + gap,
      top: topRight + rightHeroHeight + gap,
      width: bottomRightWidth,
      height: bottomRightHeight,
      rotate: 0,
      zIndex: 23
    }
  ];

  return frames[index] ?? frames[0]!;
}

function animatedFeedImageFrame(progress: Animated.Value, sourceFrame: FeedImageFrame, targetFrame: FeedImageFrame) {
  return {
    position: "absolute" as const,
    left: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [sourceFrame.left, targetFrame.left]
    }),
    top: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [sourceFrame.top, targetFrame.top]
    }),
    width: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [sourceFrame.width, targetFrame.width]
    }),
    height: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [sourceFrame.height, targetFrame.height]
    })
  };
}

function feedImagePosition(layout: PostLayout, count: number, index: number): FeedImagePosition {
  const pick = (positions: FeedImagePosition[]) => positions[Math.min(index, positions.length - 1)]!;
  const imageLimit = Math.min(Math.max(count, 1), 4);

  if (count === 1) {
    return { width: "92%" as const, height: "88%" as const, left: "4%" as const, top: "6%" as const, baseRotation: 0 };
  }

  if (layout === "grid") {
    if (imageLimit === 2) {
      return pick([
        { width: "55%" as const, height: "72%" as const, left: "2%" as const, top: "14%" as const, baseRotation: -2 },
        { width: "55%" as const, height: "72%" as const, left: "43%" as const, top: "14%" as const, baseRotation: 2 }
      ]);
    }
    if (imageLimit === 3) {
      return pick([
        { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
        { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
        { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 }
      ]);
    }
    return pick([
      { width: "52%" as const, height: "42%" as const, left: "5%" as const, top: "13%" as const, baseRotation: -2 },
      { width: "48%" as const, height: "42%" as const, left: "47%" as const, top: "15%" as const, baseRotation: 2 },
      { width: "44%" as const, height: "34%" as const, left: "12%" as const, top: "55%" as const, baseRotation: -1 },
      { width: "38%" as const, height: "30%" as const, left: "54%" as const, top: "58%" as const, baseRotation: 1 }
    ]);
  }

  if (layout === "cascade") {
    return pick([
      { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
      { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
      { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 },
      { width: "72%" as const, height: "72%" as const, left: "17%" as const, top: "17%" as const, baseRotation: -2 }
    ]);
  }

  return pick([
    { width: "82%" as const, height: "82%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -6 },
    { width: "82%" as const, height: "82%" as const, left: "12%" as const, top: "4%" as const, baseRotation: 3 },
    { width: "82%" as const, height: "82%" as const, left: "6%" as const, top: "11%" as const, baseRotation: 0 },
    { width: "72%" as const, height: "72%" as const, left: "17%" as const, top: "17%" as const, baseRotation: -2 }
  ]);
}

function hasRecipe(post: Post) {
  return !!(post.recipe?.title || post.recipe?.ingredients?.length || (post.recipes && post.recipes.length > 0));
}

function ExpandedPostModal({
  post,
  originRect,
  onClose,
  onRecipePress,
  onCommentPress,
  onAuthorPress
}: {
  post: Post | null;
  originRect?: MotionRect;
  onClose: () => void;
  onRecipePress: () => void;
  onCommentPress: () => void;
  onAuthorPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const targetRect = getExpandedPostTargetRect({
    viewportWidth: screenWidth,
    viewportHeight: screenHeight,
    safeTop: insets.top,
    safeBottom: insets.bottom,
    bottomBarReserve: 110
  });
  const startRect = originRect ?? getFallbackOriginRect(targetRect);
  const gridPadding = 20;
  const gridGap = 10;
  const availableWidth = Math.min(targetRect.width - gridPadding * 2, 380);

  const animateClose = useCallback(() => {
    if (isClosing.current) {
      return;
    }

    isClosing.current = true;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.timing(panY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      })
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      } else {
        isClosing.current = false;
      }
    });
  }, [onClose, panY, progress]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderMove: (_, gesture) => {
          panY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 76 || gesture.vy > 0.85) {
            animateClose();
            return;
          }

          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 160,
            useNativeDriver: false
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 160,
            useNativeDriver: false
          }).start();
        }
      }),
    [animateClose, panY]
  );

  useEffect(() => {
    if (!post) {
      return;
    }

    isClosing.current = false;
    panY.setValue(0);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [panY, post, progress]);

  if (!post) return null;

  const imgCount = Math.max(post.images.length, 1);
  const isSpreadDetail = post.mediaType !== "video" && imgCount > 1;
  const stickerSource = stickerImageSource(post.stickerId) ?? (post._id.startsWith("demo") ? DEMO_STICKER : null);
  const placement = post.stickerPlacement ?? { x: 0.78, y: 0.78, scale: 1, rotation: 0 };
  const overlayOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const previewOpacity = progress.interpolate({ inputRange: [0, 0.38, 1], outputRange: [1, 0, 0], extrapolate: "clamp" });
  const detailOpacity = progress.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, 0, 1], extrapolate: "clamp" });
  const detailTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const animatedCardStyle = {
    left: progress.interpolate({ inputRange: [0, 1], outputRange: [startRect.x, targetRect.x] }),
    top: progress.interpolate({ inputRange: [0, 1], outputRange: [startRect.y, targetRect.y] }),
    width: progress.interpolate({ inputRange: [0, 1], outputRange: [startRect.width, targetRect.width] }),
    height: progress.interpolate({ inputRange: [0, 1], outputRange: [startRect.height, targetRect.height] }),
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [22, 28] })
  };

  function renderImageCalorieBadge(imageIndex: number) {
    const caloriesOfCurrentImage = getCaloriesOfCurrentImage(post!, imageIndex);

    if (!caloriesOfCurrentImage) {
      return null;
    }

    return (
      <View style={expandedStyles.imageCaloBadge}>
        <AppText style={expandedStyles.imageCaloText}>{Math.round(caloriesOfCurrentImage)} Calo</AppText>
      </View>
    );
  }

  function renderImageGrid() {
    const hasRec = hasRecipe(post!);

    if (imgCount === 1) {
      return (
        <View style={expandedStyles.singleImageWrap}>
          <Image source={imageSource(post!, 0)} style={expandedStyles.singleImage} resizeMode="cover" />
          {renderImageCalorieBadge(0)}

          {/* Caption Overlay - Top Left */}
          <View style={[expandedStyles.overlayBadge, { left: 14, top: 14 }]}>
            <Ionicons name="location" size={15} color={colors.black} />
            <AppText numberOfLines={2} style={expandedStyles.overlayBadgeText}>
              {post!.caption || "Nó ngon phải biết"}
            </AppText>
          </View>

          {/* Stats Overlay - Top Right */}
          <View style={[expandedStyles.overlayBadge, { right: 14, top: 14 }]}>
            <AppText style={expandedStyles.statsNum}>{Math.max(0, post!.stats?.comments ?? 0)}</AppText>
            <Ionicons name="chatbubble-outline" size={14} color={colors.black} />
            <AppText style={expandedStyles.statsNum}>{Math.max(0, post!.stats?.likes ?? 0)}</AppText>
            <Ionicons name="heart" size={14} color={colors.red} />
          </View>

          {/* Recipe Overlay - Bottom Left */}
          {hasRec ? (
            <Pressable style={expandedStyles.recipeOverlayBtn} onPress={onRecipePress}>
              <View style={expandedStyles.recipeDashedCircleMini}>
                <Ionicons name="clipboard-outline" size={18} color={colors.muted} />
                <AppText style={expandedStyles.recipeMiniLabel}>Công thức</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
      );
    }

    // 2 or 3 images (2-column masonry-style layout)
    const colW = (availableWidth - gridGap) / 2;
    const isTwoImg = imgCount === 2;

    return (
      <View style={{ flexDirection: "row", gap: gridGap, width: "100%" }}>
        {/* Left Column */}
        <View style={{ flex: 1, gap: gridGap, paddingTop: (isTwoImg && !hasRec) ? 40 : 0 }}>
          {/* Case: 2 images + Has Recipe -> Caption card block at the top of left column */}
          {isTwoImg && hasRec ? (
            <View style={expandedStyles.captionCardBlock}>
              <Ionicons name="location" size={17} color={colors.black} />
              <AppText numberOfLines={3} style={expandedStyles.captionCardBlockText}>
                {post!.caption || "Nó ngon phải biết"}
              </AppText>
            </View>
          ) : null}

          {/* Image 1 (Always at top of left column, except below caption card if isTwoImg && hasRec) */}
          <View style={[expandedStyles.gridItem, { width: colW, height: colW * 1.25 }]}>
            <Image source={imageSource(post!, 0)} style={expandedStyles.gridImage} resizeMode="cover" />
            {renderImageCalorieBadge(0)}

            {/* Caption Overlay on Image 1 (If not rendered as block card) */}
            {!(isTwoImg && hasRec) ? (
              <View
                style={[
                  expandedStyles.overlayBadge,
                  isTwoImg
                    ? { left: 10, bottom: 10 } // Bottom left for 2 images
                    : { left: 10, top: 10 }    // Top left for 3 images
                ]}
              >
                <Ionicons name="location" size={14} color={colors.black} />
                <AppText numberOfLines={2} style={expandedStyles.overlayBadgeText}>
                  {post!.caption || "Nó ngon phải biết"}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Image 3 (Only if 3 images) */}
          {!isTwoImg && imgCount >= 3 ? (
            <View style={[expandedStyles.gridItem, { width: colW, height: colW * 0.95 }]}>
              <Image source={imageSource(post!, 2)} style={expandedStyles.gridImage} resizeMode="cover" />
              {renderImageCalorieBadge(2)}
            </View>
          ) : null}
        </View>

        {/* Right Column */}
        <View style={{ flex: 1, gap: gridGap }}>
          {/* Image 2 (Always at top of right column) */}
          <View style={[expandedStyles.gridItem, { width: colW, height: colW * 1.25 }]}>
            <Image source={imageSource(post!, 1)} style={expandedStyles.gridImage} resizeMode="cover" />
            {renderImageCalorieBadge(1)}

            {/* Stats Overlay on Image 2 */}
            <View style={[expandedStyles.overlayBadge, { right: 10, top: 10 }]}>
              <AppText style={expandedStyles.statsNum}>{Math.max(0, post!.stats?.comments ?? 0)}</AppText>
              <Ionicons name="chatbubble-outline" size={13} color={colors.black} />
              <AppText style={expandedStyles.statsNum}>{Math.max(0, post!.stats?.likes ?? 0)}</AppText>
              <Ionicons name="heart" size={13} color={colors.red} />
            </View>
          </View>

          {/* Recipe Button inside Right Column (Only if hasRecipe) */}
          {hasRec ? (
            <Pressable style={[expandedStyles.recipeGridCard, { width: colW, height: colW * 0.95 }]} onPress={onRecipePress}>
              <View style={expandedStyles.recipeDashedCircleGrid}>
                <Ionicons name="clipboard-outline" size={32} color={colors.muted} />
                <AppText style={expandedStyles.recipeDashedLabelGrid}>Công thức</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  function getSpreadStage() {
    const width = Math.min(screenWidth - 36, 370);
    const height = Math.min(screenHeight - insets.top - insets.bottom - 84, width * 1.5);
    const x = (screenWidth - width) / 2;
    const y = insets.top + Math.max(14, (screenHeight - insets.top - insets.bottom - height - 48) / 2);
    return { x, y, width, height };
  }

  function spreadImageFrame(index: number) {
    const stage = getSpreadStage();
    const twoImageFrames = [
      {
        left: stage.x + stage.width * 0.06,
        top: stage.y + stage.width * 0.4,
        width: stage.width * 0.43,
        height: stage.width * 0.62,
        rotate: "0deg",
        zIndex: 24
      },
      {
        left: stage.x + stage.width * 0.53,
        top: stage.y + stage.width * 0.18,
        width: stage.width * 0.43,
        height: stage.width * 0.62,
        rotate: "0deg",
        zIndex: 26
      }
    ];
    const threeImageFrames = [
      {
        left: stage.x + stage.width * 0.06,
        top: stage.y + stage.width * 0.18,
        width: stage.width * 0.5,
        height: stage.width * 0.52,
        rotate: "0deg",
        zIndex: 24
      },
      {
        left: stage.x + stage.width * 0.6,
        top: stage.y + stage.width * 0.2,
        width: stage.width * 0.36,
        height: stage.width * 0.46,
        rotate: "0deg",
        zIndex: 28
      },
      {
        left: stage.x + stage.width * 0.26,
        top: stage.y + stage.width * 0.74,
        width: stage.width * 0.36,
        height: stage.width * 0.34,
        rotate: "0deg",
        zIndex: 22
      }
    ];
    const fourImageFrames = [
      {
        left: stage.x + stage.width * 0.04,
        top: stage.y + stage.width * 0.18,
        width: stage.width * 0.44,
        height: stage.width * 0.42,
        rotate: "0deg",
        zIndex: 24
      },
      {
        left: stage.x + stage.width * 0.52,
        top: stage.y + stage.width * 0.18,
        width: stage.width * 0.44,
        height: stage.width * 0.42,
        rotate: "0deg",
        zIndex: 26
      },
      {
        left: stage.x + stage.width * 0.14,
        top: stage.y + stage.width * 0.66,
        width: stage.width * 0.36,
        height: stage.width * 0.32,
        rotate: "0deg",
        zIndex: 22
      },
      {
        left: stage.x + stage.width * 0.54,
        top: stage.y + stage.width * 0.66,
        width: stage.width * 0.34,
        height: stage.width * 0.32,
        rotate: "0deg",
        zIndex: 23
      }
    ];

    if (imgCount === 2) {
      return twoImageFrames[index] ?? twoImageFrames[0]!;
    }

    if (imgCount === 3) {
      return threeImageFrames[index] ?? threeImageFrames[0]!;
    }

    return fourImageFrames[index] ?? fourImageFrames[0]!;
  }

  function spreadMetaFrame(kind: "caption" | "stats" | "recipe" | "author" | "sticker" | "close") {
    const stage = getSpreadStage();

    if (kind === "caption") {
      return { left: stage.x + stage.width * 0.06, top: stage.y + stage.width * 0.08, width: stage.width * (imgCount === 2 ? 0.66 : 0.48) };
    }

    if (kind === "stats") {
      return { left: stage.x + stage.width * 0.58, top: stage.y + stage.width * 0.06, width: stage.width * 0.38 };
    }

    if (kind === "recipe") {
      return {
        left: stage.x + stage.width * (imgCount === 2 ? 0.58 : 0.66),
        top: stage.y + stage.width * (imgCount >= 4 ? 1.02 : 0.78),
        width: stage.width * 0.28
      };
    }

    if (kind === "author") {
      return { left: stage.x + stage.width * 0.18, top: stage.y + stage.width * 1.18, width: stage.width * 0.64 };
    }

    if (kind === "sticker") {
      return {
        left: stage.x + stage.width * (imgCount === 2 ? 0.14 : 0.04),
        top: stage.y + stage.width * (imgCount === 2 ? 0.2 : 0.96),
        width: 76
      };
    }

    return { left: screenWidth - 60, top: insets.top + 10, width: 42 };
  }

  function spreadSourceFrame(index: number) {
    const imageLimit = Math.min(imgCount, 4);
    const gap = Math.min(10, startRect.width * 0.025);

    if (imageLimit === 2) {
      const width = (startRect.width - gap) / 2;
      const height = startRect.height * 0.68;
      return {
        left: startRect.x + index * (width + gap),
        top: startRect.y + startRect.height * 0.16,
        width,
        height
      };
    }

    const width = (startRect.width - gap) / 2;
    const height = (startRect.height - gap) / 2;
    return {
      left: startRect.x + (index % 2) * (width + gap),
      top: startRect.y + Math.floor(index / 2) * (height + gap),
      width,
      height
    };
  }

  function animatedSpreadFrame(frame: { left: number; top: number; width: number; height?: number; rotate?: string }, index: number) {
    const sourceFrame = spreadSourceFrame(index);

    return {
      left: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceFrame.left, frame.left]
      }),
      top: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceFrame.top, frame.top]
      }),
      width: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceFrame.width, frame.width]
      }),
      height: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceFrame.height, frame.height ?? frame.width]
      }),
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1],
        extrapolate: "clamp"
      }),
      transform: [
        {
          rotate: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0deg", frame.rotate ?? "0deg"]
          })
        }
      ]
    };
  }

  function animatedSpreadMeta(frame: { left: number; top: number; width: number }, yOffset = 14) {
    return {
      left: frame.left,
      top: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [frame.top + yOffset, frame.top]
      }),
      width: frame.width,
      opacity: progress.interpolate({
        inputRange: [0, 0.58, 1],
        outputRange: [0, 0, 1],
        extrapolate: "clamp"
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1]
          })
        }
      ]
    };
  }

  function renderSpreadDetail() {
    const imageLimit = Math.min(imgCount, 4);
    const recipeFrame = spreadMetaFrame("recipe");
    const authorFrame = spreadMetaFrame("author");
    const stickerFrame = spreadMetaFrame("sticker");
    const closeFrame = spreadMetaFrame("close");

    return (
      <Modal visible transparent animationType="none" onRequestClose={animateClose}>
        <View style={expandedStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={animateClose}>
            <View style={expandedStyles.spreadBackdrop} />
          </Pressable>

          <Animated.View pointerEvents="box-none" style={[expandedStyles.spreadLayer, { transform: [{ translateY: panY }] }]}>
            {Array.from({ length: imageLimit }).map((_, index) => {
              const frame = spreadImageFrame(index);

              return (
                <Animated.View
                  key={`${post!._id}-spread-${index}`}
                  style={[
                    expandedStyles.spreadImageCard,
                    {
                      zIndex: frame.zIndex,
                      elevation: frame.zIndex,
                      ...animatedSpreadFrame(frame, index)
                    }
                  ]}
                >
                  <Image source={imageSource(post!, index)} style={expandedStyles.spreadImage} resizeMode="cover" />
                  {renderImageCalorieBadge(index)}
                </Animated.View>
              );
            })}

            <Animated.View style={[expandedStyles.spreadCaptionBubble, animatedSpreadMeta(spreadMetaFrame("caption"))]}>
              <Ionicons name="location" size={17} color={colors.black} />
              <AppText numberOfLines={2} style={expandedStyles.spreadCaptionText}>
                {post!.caption || "NÃ³ ngon pháº£i biáº¿t"}
              </AppText>
            </Animated.View>

            <Animated.View style={[expandedStyles.spreadStatsBubble, animatedSpreadMeta(spreadMetaFrame("stats"), 20)]}>
              <AppText style={expandedStyles.spreadStatsText}>{Math.max(0, post!.stats?.comments ?? 0)}</AppText>
              <Ionicons name="chatbubble-outline" size={16} color={colors.black} />
              <AppText style={expandedStyles.spreadStatsText}>{Math.max(0, post!.stats?.likes ?? 0)}</AppText>
              <Ionicons name="heart" size={17} color={colors.red} />
            </Animated.View>

            {hasRecipe(post!) ? (
              <Animated.View style={[expandedStyles.spreadRecipeWrap, animatedSpreadMeta(recipeFrame, 26)]}>
                <Pressable style={expandedStyles.spreadRecipeCard} onPress={onRecipePress}>
                  <Ionicons name="clipboard-outline" size={30} color={colors.muted} />
                  <AppText style={expandedStyles.spreadRecipeText}>CÃ´ng thá»©c</AppText>
                </Pressable>
              </Animated.View>
            ) : null}

            {stickerSource ? (
              <Animated.View style={[expandedStyles.spreadSticker, animatedSpreadMeta(stickerFrame, -18)]}>
                <Wiggle style={{ width: "100%", height: "100%" }}>
                  <Image source={stickerSource} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                </Wiggle>
              </Animated.View>
            ) : null}

            <Animated.View style={[expandedStyles.spreadAuthorWrap, animatedSpreadMeta(authorFrame, 24)]}>
              <FeedAuthorChip post={post!} onAuthorPress={onAuthorPress} expanded />
            </Animated.View>

            <Animated.View style={[expandedStyles.spreadCloseWrap, animatedSpreadMeta(closeFrame, -10)]}>
              <Pressable style={expandedStyles.spreadCloseButton} onPress={animateClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.black} />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  if (isSpreadDetail) {
    return renderSpreadDetail();
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={animateClose}>
      <View style={expandedStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose}>
          <Animated.View style={[expandedStyles.dimBackdrop, { opacity: overlayOpacity }]} />
        </Pressable>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            expandedStyles.container,
            animatedCardStyle,
            {
              transform: [{ translateY: panY }]
            }
          ]}
        >
          <Animated.View pointerEvents="none" style={[expandedStyles.previewLayer, { opacity: previewOpacity }]}>
            <FeedArtwork post={post} />
          </Animated.View>

          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            style={[
              expandedStyles.detailLayer,
              {
                opacity: detailOpacity,
                transform: [{ translateY: detailTranslateY }]
              }
            ]}
            contentContainerStyle={expandedStyles.scrollContent}
          >
            <View style={expandedStyles.dragHandle} />

            <View style={{ position: "relative", width: availableWidth, marginTop: 8 }}>
              {renderImageGrid()}

              {stickerSource ? (
                <Wiggle
                  style={[
                    styles.feedSticker,
                    {
                      position: "absolute",
                      left: `${placement.x * 100}%`,
                      top: `${placement.y * 100}%`,
                      transform: [
                        { translateX: -25 },
                        { translateY: -25 },
                        { rotate: `${placement.rotation}deg` },
                        { scale: placement.scale }
                      ],
                      zIndex: 99
                    }
                  ]}
                >
                  <Image source={stickerSource} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                </Wiggle>
              ) : null}
            </View>

            <FeedAuthorChip post={post} onAuthorPress={onAuthorPress} expanded />
          </Animated.ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function previewImageIndex(post: Post) {
  const imageCount = Math.max(post.images.length, 1);
  return Math.min(imageCount, 3) - 1;
}

const expandedStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent"
  },
  dimBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  container: {
    position: "absolute",
    backgroundColor: colors.surface,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12
  },
  previewLayer: {
    ...StyleSheet.absoluteFillObject,
    padding: 0
  },
  detailLayer: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    alignItems: "center"
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(31,31,31,0.14)",
    marginTop: -6,
    marginBottom: -2
  },
  spreadLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible"
  },
  spreadBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.canvas
  },
  spreadImageCard: {
    position: "absolute",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.canvasStrong,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18
  },
  spreadImage: {
    width: "100%",
    height: "100%"
  },
  spreadCaptionBubble: {
    position: "absolute",
    zIndex: 40,
    elevation: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 15,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12
  },
  spreadCaptionText: {
    flex: 1,
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18
  },
  spreadStatsBubble: {
    position: "absolute",
    zIndex: 42,
    elevation: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12
  },
  spreadStatsText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18
  },
  spreadRecipeWrap: {
    position: "absolute",
    zIndex: 34,
    elevation: 34
  },
  spreadRecipeCard: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(82,82,82,0.32)",
    backgroundColor: "rgba(255,255,255,0.62)",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  spreadRecipeText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center"
  },
  spreadSticker: {
    position: "absolute",
    height: 76,
    zIndex: 48,
    elevation: 48
  },
  spreadAuthorWrap: {
    position: "absolute",
    zIndex: 44,
    elevation: 44,
    alignItems: "center"
  },
  spreadCloseWrap: {
    position: "absolute",
    zIndex: 60,
    elevation: 60
  },
  spreadCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10
  },
  statsNum: {
    fontFamily: fonts.semibold,
    fontSize: 12,
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
  authorChipWrap: {
    alignSelf: "center",
    maxWidth: "86%",
    position: "relative",
    overflow: "visible"
  },
  authorChipWrapWithStreak: {
    marginLeft: 0
  },
  authorChip: {
    alignSelf: "center",
    maxWidth: "100%",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 18,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 4
  },
  authorStreakBadge: {
    position: "absolute",
    left: -40,
    top: -43,
    width: 78,
    height: 78,
    zIndex: 1,
    elevation: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  authorStreakImage: {
    width: "100%",
    height: "100%"
  },
  authorStreakCountWrap: {
    position: "absolute",
    left: -40,
    top: -43,
    width: 78,
    height: 78,
    zIndex: 1,
    elevation: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  authorStreakCountText: {
    marginTop: 20,
    marginLeft: -2,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    transform: [{ rotate: "-30deg" }]
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
    fontFamily: fonts.bold,
    fontSize: 15
  },
  overlayBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10
  },
  overlayBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.black,
    maxWidth: 140
  },
  imageCaloBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 12,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  imageCaloText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.black
  },
  captionCardBlock: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 50
  },
  captionCardBlockText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.black,
    flex: 1
  },
  recipeOverlayBtn: {
    position: "absolute",
    left: 14,
    bottom: 14,
    zIndex: 10
  },
  recipeDashedCircleMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18
  },
  recipeMiniLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted
  },
  recipeGridCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.muted,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center"
  },
  recipeDashedCircleGrid: {
    alignItems: "center",
    gap: 6
  },
  recipeDashedLabelGrid: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted
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
          <Pressable style={styles.recommendationFeatured} onPress={() => onNavigate("MealRecommendation")}>
            <View style={styles.recommendationFeaturedIcon}>
              <Ionicons name="sparkles" size={24} color={colors.greenDark} />
            </View>
            <View style={styles.recommendationFeaturedCopy}>
              <AppText variant="button" style={styles.recommendationFeaturedTitle}>Hôm nay ăn gì?</AppText>
              <AppText variant="caption" style={styles.recommendationFeaturedSubtitle}>Chọn món theo khẩu vị, thời gian và vị trí của bạn.</AppText>
            </View>
            <Ionicons name="chevron-forward" size={21} color={colors.greenDark} />
          </Pressable>
          <View style={styles.categoryGrid}>
            {CATEGORY_ITEMS.map((item) => (
              <Pressable
                key={item.label}
                style={styles.categoryItem}
                onPress={() => onNavigate(item.screen)}
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

function NutritionDetailModal({ post, token, onClose }: { post: Post | null; token?: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const [insightCache, setInsightCache] = useState<Record<string, MealSuitabilityInsight>>({});
  const [insightLoadingPostId, setInsightLoadingPostId] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const attemptedInsightPostIds = useRef<Set<string>>(new Set());
  const postId = post?._id;
  const insight = postId ? insightCache[postId] : undefined;
  const isInsightLoading = Boolean(postId && insightLoadingPostId === postId);
  const hasNutritionForInsight = Boolean(
    post?.nutritionSummary?.calories ||
    post?.nutritionDetails?.some((detail) => detail.total?.calories || detail.items?.length)
  );
  const canAnalyzeInsight = Boolean(token && postId && !postId.startsWith("demo") && hasNutritionForInsight);

  const loadInsight = useCallback(async (force = false) => {
    if (!token || !postId || postId.startsWith("demo")) {
      return;
    }

    if (!force && attemptedInsightPostIds.current.has(postId)) {
      return;
    }

    attemptedInsightPostIds.current.add(postId);
    setInsightError(null);
    setInsightLoadingPostId(postId);

    try {
      const result = await api.postNutritionInsight(token, postId);
      setInsightCache((current) => ({
        ...current,
        [postId]: result.insight
      }));
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Không thể phân tích bữa ăn lúc này");
    } finally {
      setInsightLoadingPostId((current) => (current === postId ? null : current));
    }
  }, [postId, token]);

  useEffect(() => {
    setInsightError(null);
  }, [postId]);

  useEffect(() => {
    if (!postId || !canAnalyzeInsight || insight || isInsightLoading) {
      return;
    }

    void loadInsight();
  }, [canAnalyzeInsight, insight, isInsightLoading, loadInsight, postId]);

  if (!post) {
    return null;
  }

  const total = post.nutritionSummary;
  const nutritionScrollMaxHeight = Math.max(280, Math.round(viewportHeight * 0.76));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.nutritionSheet} onPress={() => { }}>
          <View style={styles.sheetHandle} />
          <ScrollView
            style={[styles.nutritionScroll, { maxHeight: nutritionScrollMaxHeight }]}
            contentContainerStyle={[styles.nutritionScrollContent, { paddingBottom: insets.bottom + 18 }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.nutritionHero}>
            <View style={styles.nutritionHeroIcon}>
              <Ionicons name="flame" size={25} color={colors.red} />
            </View>
            <View style={styles.nutritionHeroCopy}>
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
              <MacroPill label="Protein" value={`${Math.round(total.protein)}g`} icon="barbell-outline" />
              <MacroPill label="Carbs" value={`${Math.round(total.carbs)}g`} icon="leaf-outline" />
              <MacroPill label="Fat" value={`${Math.round(total.fat)}g`} icon="water-outline" />
            </View>
          ) : null}

          <MealInsightCard
            insight={insight}
            loading={isInsightLoading}
            error={insightError}
            canAnalyze={canAnalyzeInsight}
            onRetry={() => {
              void loadInsight(true);
            }}
            post={post}
          />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function mealInsightItemKey(item: NonNullable<MealSuitabilityInsight["itemInsights"]>[number]) {
  return item.key ?? `${item.imageIndex}-${item.itemIndex}-${item.name}`;
}

function MealInsightCard({
  insight,
  loading,
  error,
  canAnalyze,
  onRetry,
  post
}: {
  insight?: MealSuitabilityInsight;
  loading: boolean;
  error: string | null;
  canAnalyze: boolean;
  onRetry: () => void;
  post: Post;
}) {
  const [selectedInsightKey, setSelectedInsightKey] = useState("overall");
  const itemInsights = insight?.itemInsights ?? [];
  const selectedItem = selectedInsightKey === "overall"
    ? undefined
    : itemInsights.find((item) => mealInsightItemKey(item) === selectedInsightKey);
  const suitableFor = insight?.suitableFor ?? [];
  const cautionFor = insight?.cautionFor ?? [];
  const suggestions = insight?.suggestions ?? [];
  const visibleSuitableFor = selectedItem?.suitableFor ?? suitableFor;
  const visibleCautionFor = selectedItem?.cautionFor ?? cautionFor;
  const visibleSuggestions = selectedItem?.suggestions ?? suggestions;

  const matchingNutritionDetail = selectedItem
    ? post.nutritionDetails?.find((d) => d.imageIndex === selectedItem.imageIndex)
    : undefined;
  const matchingImageUrl = selectedItem && post.images?.[selectedItem.imageIndex]?.url
    ? post.images[selectedItem.imageIndex].url
    : undefined;
  const matchingImageSource = matchingImageUrl
    ? (matchingImageUrl.startsWith("http") ? { uri: matchingImageUrl } : { uri: `${api.baseUrl}${matchingImageUrl}` })
    : undefined;

  useEffect(() => {
    setSelectedInsightKey("overall");
  }, [insight]);

  return (
    <View style={styles.aiInsightCard}>
      <View style={styles.aiInsightHeader}>
        <View style={styles.aiInsightTitleWrap}>
          <Ionicons name="sparkles" size={16} color={colors.greenDark} />
          <AppText style={styles.aiInsightTitle}>AI phù hợp với ai?</AppText>
        </View>
        {insight?.source === "fallback" ? (
          <View style={styles.aiInsightSourcePill}>
            <AppText style={styles.aiInsightSourceText}>Dự phòng</AppText>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.aiInsightLoading}>
          <ActivityIndicator color={colors.greenDark} />
          <AppText style={styles.aiInsightMuted}>AI đang đọc bảng calo và protein từng món...</AppText>
        </View>
      ) : insight ? (
        <>
          {itemInsights.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.aiInsightTabs}
              contentContainerStyle={styles.aiInsightTabsContent}
            >
              <Pressable
                style={[styles.aiInsightTab, selectedInsightKey === "overall" && styles.aiInsightTabActive]}
                onPress={() => setSelectedInsightKey("overall")}
              >
                <Ionicons name="restaurant-outline" size={13} color={selectedInsightKey === "overall" ? colors.white : colors.greenDark} />
                <AppText style={[styles.aiInsightTabText, selectedInsightKey === "overall" && styles.aiInsightTabTextActive]}>
                  {"T\u1ed5ng b\u1eefa"}
                </AppText>
              </Pressable>
              {itemInsights.map((item) => {
                const itemKey = mealInsightItemKey(item);
                const isSelected = selectedInsightKey === itemKey;

                return (
                  <Pressable
                    key={itemKey}
                    style={[styles.aiInsightTab, isSelected && styles.aiInsightTabActive]}
                    onPress={() => setSelectedInsightKey(itemKey)}
                  >
                    <AppText numberOfLines={1} style={[styles.aiInsightTabText, isSelected && styles.aiInsightTabTextActive]}>
                      {item.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <AppText style={styles.aiInsightHeadline}>{selectedItem?.name ?? insight.headline}</AppText>
          <AppText style={styles.aiInsightBody}>{selectedItem?.verdict ?? insight.summary}</AppText>
          <AppText style={styles.aiInsightMacro}>
            {selectedItem
              ? `${selectedItem.portion} - ${Math.round(selectedItem.calories)} kcal - ${Math.round(selectedItem.protein)}g protein\n${selectedItem.macroNote}`
              : insight.macroBalance}
          </AppText>

          {visibleSuitableFor.length ? (
            <View style={styles.aiInsightGroup}>
              <AppText style={styles.aiInsightGroupTitle}>Phù hợp</AppText>
              {visibleSuitableFor.map((target) => (
                <View key={`fit-${target.label}`} style={styles.aiInsightTarget}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.greenDark} />
                  <View style={styles.aiInsightTargetCopy}>
                    <AppText style={styles.aiInsightTargetLabel}>{target.label}</AppText>
                    <AppText style={styles.aiInsightTargetReason}>{target.reason}</AppText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {visibleCautionFor.length ? (
            <View style={styles.aiInsightGroup}>
              <AppText style={styles.aiInsightGroupTitle}>Nên cân nhắc</AppText>
              {visibleCautionFor.map((target) => (
                <View key={`caution-${target.label}`} style={styles.aiInsightTarget}>
                  <Ionicons name="alert-circle" size={15} color={colors.red} />
                  <View style={styles.aiInsightTargetCopy}>
                    <AppText style={styles.aiInsightTargetLabel}>{target.label}</AppText>
                    <AppText style={styles.aiInsightTargetReason}>{target.reason}</AppText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {visibleSuggestions.length ? (
            <View style={styles.aiSuggestionWrap}>
              {visibleSuggestions.map((suggestion) => (
                <View key={suggestion} style={styles.aiSuggestionPill}>
                  <Ionicons name="leaf-outline" size={13} color={colors.greenDark} />
                  <AppText style={styles.aiSuggestionText}>{suggestion}</AppText>
                </View>
              ))}
            </View>
          ) : null}

          {selectedItem && matchingImageSource ? (
            <Image
              source={matchingImageSource}
              style={styles.aiInsightItemImage}
              resizeMode="cover"
            />
          ) : null}

          {selectedItem && matchingNutritionDetail ? (
            <View style={styles.aiInsightItemTable}>
              <View style={[styles.nutritionTableRow, styles.nutritionTableHead]}>
                <AppText style={[styles.nutritionCell, styles.ingredientCell]}>Thành phần</AppText>
                <AppText style={[styles.nutritionCell, styles.portionCell]}>Định lượng</AppText>
                <AppText style={styles.nutritionCell}>Calo</AppText>
                <AppText style={styles.nutritionCell}>Protein</AppText>
              </View>
              {formatNutritionDetailRows(matchingNutritionDetail).map((row) => (
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
          ) : null}
        </>
      ) : (
        <Pressable
          style={[styles.aiInsightButton, !canAnalyze && styles.aiInsightButtonDisabled]}
          disabled={!canAnalyze}
          onPress={onRetry}
        >
          <Ionicons name="sparkles-outline" size={16} color={canAnalyze ? colors.white : colors.muted} />
          <AppText style={[styles.aiInsightButtonText, !canAnalyze && styles.aiInsightButtonTextDisabled]}>
            Phân tích bằng AI
          </AppText>
        </Pressable>
      )}

      {error ? (
        <View style={styles.aiInsightError}>
          <AppText style={styles.aiInsightErrorText}>{error}</AppText>
          {canAnalyze ? (
            <Pressable style={styles.aiInsightRetry} onPress={onRetry}>
              <Ionicons name="refresh" size={14} color={colors.greenDark} />
              <AppText style={styles.aiInsightRetryText}>Thử lại</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MacroPill({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.macroPill}>
      <View style={styles.macroIconWrap}>
        <Ionicons name={icon} size={15} color={colors.greenDark} />
      </View>
      <AppText style={styles.macroLabel}>{label}</AppText>
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
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 15
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
    borderBottomLeftRadius: 0,
    backgroundColor: "#8BA58A",
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8
  },
  recipeChipText: {
    color: colors.white,
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
    borderBottomRightRadius: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8
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
    borderBottomRightRadius: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    width: 172,
    minHeight: 38,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8
  },
  caloText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.white,
    textAlign: "center"
  },
  caloHintText: {
    maxWidth: 160,
    fontSize: 14,
    lineHeight: 18,
    color: colors.white
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
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8
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
  heartRainLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    zIndex: 140,
    elevation: 24,
    overflow: "visible"
  },
  heartRainHeart: {
    position: "absolute",
    left: "50%",
    top: "54%",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center"
  },
  authorChipWrap: {
    marginTop: 10,
    alignSelf: "center",
    maxWidth: "86%",
    position: "relative",
    overflow: "visible"
  },
  authorChipWrapWithStreak: {
    marginLeft: 0
  },
  authorChip: {
    alignSelf: "center",
    maxWidth: "100%",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.green,
    paddingLeft: 5,
    paddingRight: 16,
    paddingVertical: 4,
    borderRadius: 9999,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8
  },
  authorStreakBadge: {
    position: "absolute",
    left: -42,
    top: -45,
    width: 82,
    height: 82,
    zIndex: 1,
    elevation: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  authorStreakImage: {
    width: "100%",
    height: "100%"
  },
  authorStreakCountWrap: {
    position: "absolute",
    left: -42,
    top: -45,
    width: 82,
    height: 82,
    zIndex: 1,
    elevation: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  authorStreakCountText: {
    marginTop: 10,
    marginLeft: 8,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    transform: [{ rotate: "-30deg" }]
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16
  },
  authorAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.green
  },
  authorName: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18
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
  premiumTicket: {
    position: "absolute",
    top: 14,
    left: 10,
    width: 100,
    height: 54,
    zIndex: 95,
    transform: [{ rotate: "-6deg" }],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 5
  },
  premiumTicketImage: {
    width: "100%",
    height: "100%"
  },
  trialMascotRail: {
    position: "absolute",
    left: "50%",
    bottom: 82,
    zIndex: 120,
    alignItems: "center"
  },
  trialMascotButton: {
    marginLeft: -34,
    width: 68,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  trialSpeechBubble: {
    minWidth: 96,
    maxWidth: 116,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.35)",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
    alignItems: "center"
  },
  trialSpeechTail: {
    position: "absolute",
    bottom: -4,
    width: 8,
    height: 8,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.97)",
    transform: [{ rotate: "45deg" }],
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(139,165,138,0.25)"
  },
  trialSpeechText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    lineHeight: 11,
    textAlign: "center"
  },
  trialOfferOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    zIndex: 300
  },
  trialOfferBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  trialOfferCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 10,
    alignItems: "center"
  },
  trialOfferIconWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(169,194,155,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  trialOfferIcon: {
    width: 96,
    height: 96
  },
  trialOfferTitle: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center"
  },
  trialOfferMessage: {
    marginTop: 10,
    color: colors.black,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  trialOfferPerks: {
    marginTop: 14,
    width: "100%",
    gap: 8,
    backgroundColor: "rgba(139,165,138,0.09)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  trialOfferPerk: {
    color: colors.black,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18
  },
  trialOfferActions: {
    marginTop: 16,
    width: "100%",
    flexDirection: "row",
    gap: 12
  },
  trialOfferSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  trialOfferSecondaryText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14
  },
  trialOfferPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  trialOfferPrimaryText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14
  },
  trialModelWrap: {
    width: 68,
    height: 75,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  trialSpriteGlow: {
    position: "absolute",
    width: 60,
    height: 64,
    borderRadius: 30,
    backgroundColor: "rgba(203,231,162,0.18)",
    shadowColor: "#DFF2A1",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }
  },
  trialMascotCutout: {
    position: "absolute",
    width: 62,
    height: 69,
    top: 1,
    borderRadius: 14
  },
  trialSparkleLeft: {
    position: "absolute",
    top: 16,
    left: 1,
    width: 5,
    height: 5,
    borderRadius: 1.5,
    borderWidth: 1.5,
    borderColor: colors.yellow,
    transform: [{ rotate: "45deg" }]
  },
  trialSparkleRight: {
    position: "absolute",
    top: 15,
    right: 1,
    width: 5,
    height: 5,
    borderRadius: 1.5,
    borderWidth: 1.5,
    borderColor: colors.yellow,
    transform: [{ rotate: "45deg" }]
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
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 7,
    gap: 14
  },
  pillBtn: {
    width: 40,
    height: 40,
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
    backgroundColor: "#FFFDF7",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 14,
    paddingHorizontal: 18
  },
  nutritionHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#F4F8EB",
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.28)",
    paddingHorizontal: 13,
    paddingVertical: 13,
    marginBottom: 12
  },
  nutritionHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFF2D2",
    alignItems: "center",
    justifyContent: "center"
  },
  nutritionHeroCopy: {
    flex: 1,
    minWidth: 0
  },
  nutritionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14
  },
  nutritionTitle: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    marginTop: 2
  },
  nutritionEyebrow: {
    color: colors.greenDark,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 15
  },
  nutritionTotalPill: {
    minWidth: 72,
    borderRadius: 18,
    backgroundColor: colors.greenDark,
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3
  },
  nutritionTotalText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 18
  },
  macroRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  macroPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.24)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2
  },
  macroIconWrap: {
    width: 25,
    height: 25,
    borderRadius: 10,
    backgroundColor: "#EEF5E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7
  },
  macroLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14
  },
  macroValue: {
    marginTop: 1,
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20
  },
  aiInsightCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(101,169,215,0.24)",
    backgroundColor: "#F7FBFF",
    padding: 12,
    marginBottom: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  aiInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8
  },
  aiInsightTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0
  },
  aiInsightTitle: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 17
  },
  aiInsightSourcePill: {
    borderRadius: 999,
    backgroundColor: "#E8F2FA",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  aiInsightSourceText: {
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12
  },
  aiInsightLoading: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  aiInsightMuted: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16
  },
  aiInsightHeadline: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 5
  },
  aiInsightBody: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17
  },
  aiInsightMacro: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#E8F2FA",
    color: colors.greenDark,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  aiInsightTabs: {
    marginBottom: 10
  },
  aiInsightTabsContent: {
    gap: 7,
    paddingRight: 4
  },
  aiInsightTab: {
    maxWidth: 140,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.28)",
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  aiInsightTabActive: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark
  },
  aiInsightTabText: {
    flexShrink: 1,
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14
  },
  aiInsightTabTextActive: {
    color: colors.white
  },
  aiInsightGroup: {
    marginTop: 10,
    gap: 7
  },
  aiInsightGroupTitle: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14
  },
  aiInsightTarget: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7
  },
  aiInsightTargetCopy: {
    flex: 1,
    minWidth: 0
  },
  aiInsightTargetLabel: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 15
  },
  aiInsightTargetReason: {
    marginTop: 1,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15
  },
  aiSuggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10
  },
  aiSuggestionPill: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#EEF5E8",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  aiSuggestionText: {
    flexShrink: 1,
    color: colors.greenDark,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  aiInsightItemImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginTop: 12
  },
  aiInsightItemTable: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.2)",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFDF7"
  },
  aiInsightButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: colors.greenDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12
  },
  aiInsightButtonDisabled: {
    backgroundColor: colors.canvasStrong
  },
  aiInsightButtonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 15
  },
  aiInsightButtonTextDisabled: {
    color: colors.muted
  },
  aiInsightError: {
    marginTop: 9,
    borderRadius: 12,
    backgroundColor: "#FFF1EF",
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 7
  },
  aiInsightErrorText: {
    color: colors.red,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15
  },
  aiInsightRetry: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  aiInsightRetryText: {
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14
  },
  nutritionScroll: {
    paddingTop: 2
  },
  nutritionScrollContent: {
    paddingBottom: 18
  },
  nutritionTable: {
    borderWidth: 1,
    borderColor: "rgba(139,165,138,0.2)",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFDF7"
  },
  nutritionTableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(139,165,138,0.16)"
  },
  nutritionTableHead: {
    borderTopWidth: 0,
    backgroundColor: "#EEF5E8"
  },
  nutritionTotalRow: {
    backgroundColor: "#FFF5D8"
  },
  nutritionCell: {
    flex: 0.8,
    color: colors.black,
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
    fontFamily: fonts.bold,
    color: colors.greenDark
  },
  nutritionSectionMeta: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14
  },
  nutritionWarning: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#FFF5D8",
    color: colors.greenDark,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  categoryGrid: {
    flexDirection: "row",
    gap: 14
  },
  recommendationFeatured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: "#E7F0E4",
    borderWidth: 1,
    borderColor: "#C5D8C1"
  },
  recommendationFeaturedIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  recommendationFeaturedCopy: {
    flex: 1,
    gap: 2
  },
  recommendationFeaturedTitle: {
    color: colors.greenDark
  },
  recommendationFeaturedSubtitle: {
    color: colors.muted
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
