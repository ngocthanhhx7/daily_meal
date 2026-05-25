import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { demoPosts } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";

const { width: SW } = Dimensions.get("window");
const CARD_W = SW - 32;
const IMAGE_H = Math.round(CARD_W * 0.76);

// ── Image resolver ──────────────────────────────────────────────────────────
const DEMO_IMAGES = [
  require("../../assets/figma-snapshots/image1.png"),
  require("../../assets/figma-snapshots/image3.png"),
  require("../../assets/figma-snapshots/image10.png")
];

function resolveImage(post: Post, index: number) {
  const first = post.images[0]?.url;
  if (!first) return DEMO_IMAGES[index % DEMO_IMAGES.length];
  if (first.startsWith("http")) return { uri: first };
  return { uri: `${api.baseUrl}${first}` };
}

// ── Card rotation helper ─────────────────────────────────────────────────────
function cardRotation(index: number): string {
  return index % 2 === 0 ? "-1.8deg" : "1.8deg";
}

// ── PostSlide ────────────────────────────────────────────────────────────────
type PostSlideProps = {
  post: Post;
  index: number;
  slideHeight: number;
  onPress?: () => void;
};

function PostSlide({ post, index, slideHeight, onPress }: PostSlideProps) {
  const hasSticker = !!post.stickerId;

  return (
    <View style={[styles.slide, { height: slideHeight }]}>
      <Pressable
        style={[styles.card, { transform: [{ rotate: cardRotation(index) }] }]}
        onPress={onPress}
      >
        {/* ── Image ── */}
        <View style={styles.imageWrap}>
          <Image
            source={resolveImage(post, index)}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Stats chip — top right */}
          <View style={styles.statsChip}>
            <AppText style={styles.statsNum}>{post.stats?.comments ?? 0}</AppText>
            <Ionicons name="chatbubble" size={11} color={colors.ink} />
            <AppText style={styles.statsNum}>{post.stats?.likes ?? 0}</AppText>
            <Ionicons name="heart" size={11} color={colors.red} />
          </View>

          {/* Calo badge */}
          {post.nutritionSummary?.calories ? (
            <View style={styles.caloBadge}>
              <AppText style={styles.caloText}>
                {Math.round(post.nutritionSummary.calories)} Calo
              </AppText>
            </View>
          ) : null}
        </View>

        {/* ── Caption ── */}
        <View style={styles.captionArea}>
          <AppText numberOfLines={2} style={styles.captionText}>
            {post.caption || "Một bữa ăn ngon trong ngày 🍽️"}
          </AppText>
        </View>

        {/* ── Author chip ── */}
        <View style={styles.authorArea}>
          <View style={styles.authorChip}>
            {hasSticker && <AppText style={styles.fireEmoji}>🔥</AppText>}
            <View style={styles.authorAvatar}>
              <AppText style={styles.authorAvatarText}>
                {post.author?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
              </AppText>
            </View>
            <AppText style={styles.authorName} numberOfLines={1}>
              {post.author?.displayName ?? "Daily Meal"}
            </AppText>
          </View>
        </View>
      </Pressable>

      {/* Swipe hint */}
      <View style={styles.swipeHint}>
        <Ionicons name="chevron-up" size={16} color={colors.muted} />
      </View>
    </View>
  );
}

// ── Category Modal ────────────────────────────────────────────────────────────
const CATEGORY_ITEMS = [
  { icon: "search-outline" as const, label: "Tìm kiếm", screen: "Search" },
  { icon: "chatbubbles-outline" as const, label: "Tin nhắn", screen: "Inbox" },
  { icon: "person-outline" as const, label: "Hồ sơ", screen: "Profile" },
  { icon: "settings-outline" as const, label: "Cài đặt", screen: "Settings" }
] as const;

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
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHandle} />
          <AppText variant="subtitle" style={styles.sheetTitle}>
            Tính năng
          </AppText>
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
                  <Ionicons name={item.icon} size={26} color={colors.ink} />
                </View>
                <AppText variant="caption" style={styles.categoryLabel}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────
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

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setCurrentIndex(first.index);
    },
    []
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.feed(token);
      setPosts(result.posts.length ? result.posts : demoPosts);
    } catch {
      setPosts(demoPosts);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const currentPost = posts[currentIndex];
  const isLiked = currentPost ? likedSet.has(currentPost._id) : false;
  const isSaved = currentPost ? savedSet.has(currentPost._id) : false;

  async function handleLike() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    setLikedSet((s) => {
      const next = new Set(s);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    try {
      if (!postId.startsWith("demo")) {
        await api.likePost(token, postId);
      }
    } catch {
      // revert
      setLikedSet((s) => {
        const next = new Set(s);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      });
    }
  }

  async function handleSave() {
    if (!token || !currentPost) return;
    const postId = currentPost._id;
    setSavedSet((s) => {
      const next = new Set(s);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    try {
      if (!postId.startsWith("demo")) {
        await api.savePost(token, postId);
      }
    } catch {
      setSavedSet((s) => {
        const next = new Set(s);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      });
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
      {/* ── HEADER ────────────────────────────────────── */}
      <View style={styles.header}>
        <AppText style={styles.headerTitle}>Bảng tin</AppText>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIconBtn} hitSlop={8}>
            <Ionicons name="notifications-outline" size={21} color={colors.ink} />
          </Pressable>
          <Pressable
            style={styles.headerAvatar}
            onPress={() => navigation.navigate("Profile")}
            hitSlop={8}
          >
            <AppText style={styles.headerAvatarText}>
              {user?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* ── FEED ─────────────────────────────────────── */}
      <View
        style={styles.feedWrap}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      >
        {listHeight > 0 && posts.length > 0 ? (
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

      {/* ── BOTTOM ACTION BAR ────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {/* Grid / Category */}
        <Pressable
          style={styles.squareBtn}
          onPress={() => setShowCategory(true)}
          hitSlop={6}
        >
          <Ionicons name="grid-outline" size={22} color={colors.ink} />
        </Pressable>

        {/* Action pill */}
        <View style={styles.actionPill}>
          <Pressable style={styles.pillBtn} onPress={handleComment} hitSlop={4}>
            <Ionicons name="chatbubble" size={19} color={colors.white} />
          </Pressable>

          <View style={styles.pillDivider} />

          <Pressable style={styles.pillBtn} onPress={handleLike} hitSlop={4}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={19}
              color={isLiked ? colors.red : colors.white}
            />
          </Pressable>

          <View style={styles.pillDivider} />

          <Pressable style={styles.pillBtn} onPress={handleSave} hitSlop={4}>
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={19}
              color={isSaved ? colors.yellow : colors.white}
            />
          </Pressable>
        </View>

        {/* Camera / Create */}
        <Pressable
          style={styles.squareBtn}
          onPress={() => navigation.navigate("Create")}
          hitSlop={6}
        >
          <Ionicons name="camera-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {/* ── CATEGORY MODAL ───────────────────────────── */}
      <CategoryModal
        visible={showCategory}
        onClose={() => setShowCategory(false)}
        onNavigate={(screen) => navigation.navigate(screen)}
      />
    </SafeAreaView>
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  safe: {
    flex: 1
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.canvas
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: -0.5
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  headerAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white
  },

  // Feed
  feedWrap: {
    flex: 1,
    overflow: "hidden"
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },

  // Card
  card: {
    width: CARD_W,
    backgroundColor: colors.surface,
    borderRadius: 24,
    // Drop shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8
  },

  // Image
  imageWrap: {
    width: "100%",
    height: IMAGE_H,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.canvasStrong
  },
  image: {
    width: "100%",
    height: "100%"
  },

  // Stats chip
  statsChip: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  statsNum: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.ink
  },

  // Calo badge
  caloBadge: {
    position: "absolute",
    top: 52,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  caloText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.ink
  },

  // Caption
  captionArea: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10
  },
  captionText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink
  },

  // Author
  authorArea: {
    paddingHorizontal: 16,
    paddingBottom: 18
  },
  authorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.green,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 30,
    alignSelf: "flex-start"
  },
  fireEmoji: {
    fontSize: 16
  },
  authorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center"
  },
  authorAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white
  },
  authorName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.white,
    maxWidth: CARD_W - 160
  },

  // Swipe hint
  swipeHint: {
    marginTop: 10,
    opacity: 0.35
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  squareBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 0
  },
  pillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 3
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.2)"
  },

  // Category modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 28
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 20
  },
  sheetTitle: {
    marginBottom: 24
  },
  categoryGrid: {
    flexDirection: "row",
    gap: 16
  },
  categoryItem: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  categoryIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
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
