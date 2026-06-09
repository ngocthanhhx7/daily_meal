import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
const PREMIUM_TRIAL_MASCOT = require("../../assets/stickers/b76f47fb-cc9c-41e7-ada3-39fc570671c9.jpg");

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
  const [nutritionPost, setNutritionPost] = useState<Post | null>(null);
  const flatRef = useRef<FlatList>(null);
  const isInitialMount = useRef(true);
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

  const load = useCallback(async (jumpToTop = false, targetPostId?: string, targetPost?: Post) => {
    if (!token) return;
    try {
      const result = await api.feed(token);
      let feedPosts = result.posts.length ? result.posts : demoPosts;

      if (targetPostId) {
        const exists = feedPosts.some((p) => p._id === targetPostId);
        if (!exists && targetPost) {
          feedPosts = [targetPost, ...feedPosts];
        }
      }

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

      if (!targetPostId && jumpToTop) {
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
      const targetPostId = route?.params?.postId;
      const targetPost = route?.params?.targetPost;

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
      const index = posts.findIndex((p) => p._id === targetPostId);
      if (index !== -1) {
        setCurrentIndex(index);
        requestAnimationFrame(() => {
          flatRef.current?.scrollToIndex({ index, animated: false });
        });
        navigation.setParams({ postId: undefined, targetPost: undefined });
      }
    }
  }, [listHeight, route?.params?.postId, posts, navigation]);

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

  const shouldShowTrialMascot = Boolean(
    user?.preferences.completedOnboarding &&
    !user.isPremium &&
    !user.premiumTrialUsed &&
    !hideTrialMascot
  );

  async function claimTrialOffer() {
    try {
      setIsClaimingTrial(true);
      await claimPremiumTrial();
      setHideTrialMascot(true);
      setShowTrialOfferModal(false);
      Alert.alert("\u0110\u00e3 n\u00e2ng Premium!", "Premium mi\u1ec5n ph\u00ed 1 th\u00e1ng \u0111\u00e3 \u0111\u01b0\u1ee3c k\u00edch ho\u1ea1t cho b\u1ea1n.");
    } catch (error: any) {
      Alert.alert("Ch\u01b0a nh\u1eadn \u0111\u01b0\u1ee3c qu\u00e0", error?.message || "Vui l\u00f2ng th\u1eed l\u1ea1i sau nh\u00e9.");
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
  }

  function handleDeclineTrialOffer() {
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

        {shouldShowTrialMascot && (
          <PremiumTrialMascot onPress={handlePremiumTrialPress} disabled={isClaimingTrial} />
        )}

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
  "B\u1ea1n \u01a1i, c\u00f3 qu\u00e0 Premium n\u00e8!",
  "Th\u1eed 1 th\u00e1ng VIP mi\u1ec5n ph\u00ed nha!",
  "Nh\u1eadn qu\u00e0 \u0111\u1ec3 n\u1ea5u ngon h\u01a1n n\u00e0o!",
  "Miu \u0111\u1ea7u b\u1ebfp \u0111ang \u0111\u1ee3i b\u1ea1n \u0111\u00f3!"
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
              source={require("../../assets/stickers/b76f47fb-cc9c-41e7-ada3-39fc570671c9-cutout.png")}
              style={styles.trialOfferIcon}
              resizeMode="contain"
            />
          </View>
          <AppText style={styles.trialOfferTitle}>{"Nh\u1eadn 1 th\u00e1ng Premium mi\u1ec5n ph\u00ed?"}</AppText>
          <AppText style={styles.trialOfferMessage}>{"B\u1ea1n ch\u01b0a s\u1eed d\u1ee5ng \u01b0u \u0111\u00e3i l\u1ea7n \u0111\u1ea7u. N\u00e2ng l\u00ean Premium ngay \u0111\u1ec3 tr\u1ea3i nghi\u1ec7m \u0111\u1ea7y \u0111\u1ee7 t\u00ednh n\u0103ng Daily Meal trong 1 th\u00e1ng."}</AppText>
          <View style={styles.trialOfferPerks}>
            <AppText style={styles.trialOfferPerk}>{"\u2022 \u0110\u0103ng nhi\u1ec1u \u1ea3nh h\u01a1n"}</AppText>
            <AppText style={styles.trialOfferPerk}>{"\u2022 D\u00f9ng sticker Premium"}</AppText>
            <AppText style={styles.trialOfferPerk}>{"\u2022 Tr\u1ea3i nghi\u1ec7m c\u00e1c quy\u1ec1n l\u1ee3i VIP"}</AppText>
          </View>
          <View style={styles.trialOfferActions}>
            <Pressable style={styles.trialOfferSecondaryButton} onPress={onDecline} disabled={isClaiming}>
              <AppText style={styles.trialOfferSecondaryText}>{"\u0110\u1ec3 sau"}</AppText>
            </Pressable>
            <Pressable style={styles.trialOfferPrimaryButton} onPress={onAccept} disabled={isClaiming}>
              <AppText style={styles.trialOfferPrimaryText}>{isClaiming ? "\u0110ang n\u00e2ng..." : "N\u00e2ng Premium"}</AppText>
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
    const hasRec = hasRecipe(post!);

    if (imgCount === 1) {
      return (
        <View style={expandedStyles.singleImageWrap}>
          <Image source={imageSource(post!, 0)} style={expandedStyles.singleImage} resizeMode="cover" />

          {/* Caption Overlay - Top Left */}
          <View style={[expandedStyles.overlayBadge, { left: 14, top: 14 }]}>
            <Ionicons name="location" size={15} color={colors.black} />
            <AppText numberOfLines={2} style={expandedStyles.overlayBadgeText}>
              {post!.caption || "Nó ngon phải biết"}
            </AppText>
          </View>

          {/* Stats Overlay - Top Right */}
          <View style={[expandedStyles.overlayBadge, { right: 14, top: 14 }]}>
            <AppText style={expandedStyles.statsNum}>{post!.stats?.comments ?? 0}</AppText>
            <Ionicons name="chatbubble-outline" size={14} color={colors.black} />
            <AppText style={expandedStyles.statsNum}>{post!.stats?.likes ?? 0}</AppText>
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
            </View>
          ) : null}
        </View>

        {/* Right Column */}
        <View style={{ flex: 1, gap: gridGap }}>
          {/* Image 2 (Always at top of right column) */}
          <View style={[expandedStyles.gridItem, { width: colW, height: colW * 1.25 }]}>
            <Image source={imageSource(post!, 1)} style={expandedStyles.gridImage} resizeMode="cover" />

            {/* Stats Overlay on Image 2 */}
            <View style={[expandedStyles.overlayBadge, { right: 10, top: 10 }]}>
              <AppText style={expandedStyles.statsNum}>{post!.stats?.comments ?? 0}</AppText>
              <Ionicons name="chatbubble-outline" size={13} color={colors.black} />
              <AppText style={expandedStyles.statsNum}>{post!.stats?.likes ?? 0}</AppText>
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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={expandedStyles.overlay} onPress={onClose}>
        <Pressable style={expandedStyles.container} onPress={() => { }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={expandedStyles.scrollContent}>

            {/* Image grid and Sticker wrapper */}
            <View style={{ position: "relative", width: availableWidth, marginTop: 12 }}>
              {renderImageGrid()}

              {/* Sticker overlay using absolute placement */}
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
  authorChip: {
    alignSelf: "center",
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 18,
    paddingVertical: 6,
    borderRadius: 9999,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.green,
    paddingLeft: 6,
    paddingRight: 20,
    paddingVertical: 6,
    borderRadius: 9999,
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
    fontFamily: fonts.bold,
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
