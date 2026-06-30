import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Keyboard,
  Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { api } from "../api/client";
import { FigmaLineBackground } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { BouncePress } from "../components/Animations";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { IOS_MINIMUM_INPUT_FONT_SIZE, getKeyboardAvoidingBehavior } from "../utils/keyboardAvoidance";
import { getParticipantAccent, getParticipantAvatarLabel, isDoubleTap } from "./messagePresentation";
import { CameraIcon, CategoryIcon } from "../components/SvgIcons";

type Comment = {
  _id: string;
  body: string;
  author?: { displayName?: string; id?: string; avatarUrl?: string };
  createdAt?: string;
  likes?: number;
};

// --- Helpers ---

function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function imageSource(post?: Post) {
  const first = post?.images?.[0]?.url;
  if (!first) return require("../../assets/figma-snapshots/image3.png");
  if (first.startsWith("http")) return { uri: first };
  return { uri: `${api.baseUrl}${first}` };
}

function avatarSource(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${api.baseUrl}${url}` };
}

// --- Avatar ---
function Avatar({
  name,
  id,
  avatarUrl,
  size = 36,
  bg
}: {
  name?: string;
  id?: string;
  avatarUrl?: string;
  size?: number;
  bg?: string;
}) {
  const source = avatarSource(avatarUrl);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg ?? getParticipantAccent(id ?? name)
        }
      ]}
    >
      {source ? (
        <Image source={source} style={styles.avatarImage} />
      ) : (
        <AppText style={[styles.avatarText, { fontSize: size * 0.38 }]}>
          {getParticipantAvatarLabel({ displayName: name, id })}
        </AppText>
      )}
    </View>
  );
}

const DEMO_REPLIES: Record<string, { replyToDisplayName: string, replyToId: string, replyToAvatarUrl?: string }> = {
  "d3": { replyToDisplayName: "Bé Chó màu vàng", replyToId: "other2" },
  "d4": { replyToDisplayName: "Trùng bắc thảo", replyToId: "other1" }
};

// --- Bubble ---
function CommentBubble({
  comment,
  isMine,
  onDoubleLike,
  openInput
}: {
  comment: Comment;
  isMine: boolean;
  onDoubleLike: (commentId: string) => void;
  openInput: () => void;
}) {
  const lastTapRef = useRef<number | undefined>(undefined);
  const bubbleBg = isMine ? colors.white : getParticipantAccent(comment.author?.id ?? comment.author?.displayName);
  const textColor = colors.ink;

  function handleBubblePress() {
    const now = Date.now();
    if (isDoubleTap(lastTapRef.current, now)) {
      onDoubleLike(comment._id);
      lastTapRef.current = undefined;
      return;
    }

    lastTapRef.current = now;
  }

  const replyTo = DEMO_REPLIES[comment._id];
  const cleanBody = replyTo ? comment.body.replace(/^trả lời\s*/i, "") : comment.body;

  return (
    <View style={[styles.commentItemRow, isMine && { justifyContent: "flex-end" }]}>
      <View style={[styles.commentRightColumn, isMine && { alignItems: "flex-end" }]}>
        {/* Name Row */}
        <AppText style={[styles.commentAuthorName, isMine && { textAlign: "right" }]}>
          {comment.author?.displayName ?? "Daily Meal"}
        </AppText>

        {/* Bubble & Time Row */}
        <View style={[styles.commentMiddleRow, isMine && { flexDirection: "row-reverse" }]}>
          <View style={styles.commentBubbleContainer}>
            <Pressable
              onPress={handleBubblePress}
              style={[
                styles.commentBubble,
                { backgroundColor: bubbleBg, alignSelf: isMine ? "flex-end" : "flex-start" },
                isMine && { borderWidth: 1, borderColor: colors.line }
              ]}
            >
              {!isMine && (
                <Avatar
                  name={comment.author?.displayName}
                  id={comment.author?.id}
                  avatarUrl={comment.author?.avatarUrl}
                  size={36}
                />
              )}
              <View style={{ flexShrink: 1 }}>
                <AppText style={[styles.commentBubbleText, { color: textColor }]}>
                  {replyTo ? (
                    <>
                      trả lời{" "}
                      <View style={styles.inlineAvatarWrap}>
                        <Avatar
                          name={replyTo.replyToDisplayName}
                          id={replyTo.replyToId}
                          avatarUrl={replyTo.replyToAvatarUrl}
                          size={18}
                        />
                      </View>
                      {" "}{cleanBody}
                    </>
                  ) : (
                    comment.body
                  )}
                </AppText>
              </View>
            </Pressable>

            {(comment.likes ?? 0) > 0 && (
              <View style={[styles.commentLikeChipAbsolute, isMine ? { left: 12 } : { right: 12 }]}>
                {(comment.likes ?? 0) > 1 && (
                  <AppText variant="caption" style={styles.commentLikeText}>
                    {comment.likes}
                  </AppText>
                )}
                <Ionicons name="heart" size={12} color={colors.red} />
              </View>
            )}
          </View>

          <AppText variant="caption" muted style={styles.commentTimeText}>
            {relativeTime(comment.createdAt)}
          </AppText>
        </View>

        {/* Reply Action Row */}
        <View style={[styles.commentMetaRow, isMine && { justifyContent: "flex-end" }]}>
          <Pressable hitSlop={8} onPress={openInput}>
            <AppText variant="caption" muted style={styles.commentMetaText}>
              trả lời
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// --- Main Screen ---
export function CommentsScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const post: Post | undefined = route.params?.post;
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCategory, setShowCategory] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const totalLikes = post?.stats?.likes ?? 48;
  const totalComments = comments.length || post?.stats?.comments || 0;

  const headerHeight = insets.top + 56;
  const bottomBarHeight = insets.bottom + 100;
  const isInputVisible = true;

  // Real-time comments socket room integration
  useEffect(() => {
    if (!socket || !post?._id || post._id.startsWith("demo")) return;

    console.log(`🔌 Subscribing to comments room: post:${post._id}`);
    socket.emit("join-post", post._id);

    socket.on("comment:created", (newComment: Comment) => {
      console.log("💬 Live comment received via socket:", newComment);
      setComments((current) => {
        // Prevent local duplicates
        if (current.some((c) => c._id === newComment._id)) {
          return current;
        }
        return [...current, newComment];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      console.log(`🚪 Unsubscribing from comments room: post:${post._id}`);
      socket.emit("leave-post", post._id);
      socket.off("comment:created");
    };
  }, [socket, post?._id]);

  useEffect(() => {
    if (!token || !post?._id || post._id.startsWith("demo")) {
      setComments([
        {
          _id: "d1",
          body: "Món ăn của t ngon mà",
          author: { displayName: "Trùng bắc thảo", id: "other1" },
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          likes: 1
        },
        {
          _id: "d2",
          body: "M thì có còn t thì ko",
          author: { displayName: "Bé Chó màu vàng", id: "other2" },
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          likes: 2
        },
        {
          _id: "d3",
          body: "Ư nhỉ",
          author: { displayName: user?.displayName ?? "Tôi", id: user?.id },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 32 * 60 * 1000).toISOString()
        },
        {
          _id: "d4",
          body: "trả lời bạn thì bt j là n..",
          author: { displayName: "Bé Chó màu vàng", id: "other2" },
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          _id: "d5",
          body: "Ăn đi em",
          author: { displayName: "Trùng bắc thảo", id: "other1" },
          createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString()
        },
        {
          _id: "d6",
          body: "❤️",
          author: { displayName: user?.displayName ?? "Tôi", id: user?.id },
          createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
        },
        {
          _id: "d7",
          body: "2222222",
          author: { displayName: "Trùng bắc thảo", id: "other1" },
          createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString()
        }
      ]);
      return;
    }
    api
      .comments(token, post._id)
      .then((result) => setComments(result.comments as Comment[]))
      .catch(() => undefined);
  }, [token, post?._id]);

  function openInput() {
    inputRef.current?.focus();
  }

  async function send() {
    if (!token || !body.trim()) return;
    setLoading(true);
    try {
      const newComment: Comment = {
        _id: `local-${Date.now()}`,
        body: body.trim(),
        author: { displayName: user?.displayName, id: user?.id },
        createdAt: new Date().toISOString()
      };

      const postId = post?._id;

      if (postId && !postId.startsWith("demo")) {
        const result = await api.addComment(token, postId, body.trim());
        const createdComment = result.comment as Comment;
        setComments((c) => {
          if (c.some((item) => item._id === createdComment?._id)) {
            return c;
          }
          return [...c, createdComment];
        });
      } else {
        setComments((c) => [...c, newComment]);
      }

      setBody("");
      Keyboard.dismiss();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      Alert.alert("Không gửi được bình luận", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function likeComment(commentId: string) {
    setComments((current) =>
      current.map((comment) =>
        comment._id === commentId
          ? { ...comment, likes: (comment.likes ?? 0) + 1 }
          : comment
      )
    );
  }

  return (
    <FigmaLineBackground>
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={getKeyboardAvoidingBehavior(Platform.OS)}
          contentContainerStyle={styles.flex}
          keyboardVerticalOffset={0}
        >
          {/* ── CHAT BUBBLES ── */}
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.chatContent,
              {
                paddingTop: headerHeight + 12,
                paddingBottom: bottomBarHeight + 18
              }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            <Pressable onPress={Keyboard.dismiss} style={{ gap: 12, width: "100%" }}>
              {/* ── POST HERO SCROLLING CARD ── */}
              <View style={styles.scrollHeroContainer}>
                <ImageBackground
                  source={imageSource(post)}
                  style={styles.postHero}
                  imageStyle={styles.postHeroImage}
                  resizeMode="cover"
                />

                {/* ── ENGAGEMENT PILL ── */}
                <View style={styles.engagementPillContainerScroll}>
                  <View style={styles.statsRow}>
                    <Avatar
                      name={post?.author?.displayName ?? "K"}
                      id={post?.author?.id}
                      avatarUrl={post?.author?.avatarUrl}
                      size={26}
                      bg={colors.greenDark}
                    />
                    <View style={styles.statItem}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.muted} />
                      <AppText variant="caption" style={styles.statText}>{totalComments}</AppText>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="heart" size={14} color={colors.red} />
                      <AppText variant="caption" style={styles.statText}>{totalLikes}</AppText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Comments list */}
              {comments.map((comment) => {
                const author = comment.author as any;
                const currentUser = user as any;
                const commentAuthorId = author?.id ?? author?._id;
                const currentUserId = currentUser?.id ?? currentUser?._id;
                const isMine = !!(commentAuthorId && currentUserId && commentAuthorId === currentUserId);
                return (
                  <CommentBubble
                    key={comment._id}
                    comment={comment}
                    isMine={isMine}
                    onDoubleLike={likeComment}
                    openInput={openInput}
                  />
                );
              })}
            </Pressable>
          </ScrollView>

          {/* ── TRANSLUCENT HEADER OVERLAY ── */}
          <BlurView
            intensity={80}
            tint="light"
            style={[styles.headerOverlay, { paddingTop: insets.top, height: headerHeight }]}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
                  <Ionicons name="arrow-back" size={16} color={colors.white} />
                </Pressable>
                <AppText style={styles.headerTitle}>
                  Bình luận
                </AppText>
              </View>
              <View style={styles.headerRight}>
                <Pressable
                  style={styles.headerEllipsisBtn}
                  onPress={() => navigation.navigate("Settings")}
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-horizontal" size={30} color={colors.black} />
                </Pressable>
                <Pressable
                  style={styles.headerProfileBtn}
                  onPress={() => navigation.navigate("Profile")}
                  hitSlop={8}
                >
                  <Ionicons name="person" size={30} color={colors.black} />
                </Pressable>
              </View>
            </View>
          </BlurView>

          {/* ── BOTTOM ACTIONS (FLOATING BAR OR INPUT BAR) ── */}
          {isInputVisible ? (
            <BlurView
              intensity={80}
              tint="light"
              style={[styles.inputBarOverlay, { paddingBottom: insets.bottom + 10 }]}
            >
              <TextInput
                ref={inputRef}
                value={body}
                onChangeText={setBody}
                placeholder="Viết bình luận..."
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                multiline
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <Pressable
                onPress={send}
                disabled={loading || !body.trim()}
                style={[
                  styles.sendBtn,
                  (!body.trim() || loading) && styles.sendBtnDisabled
                ]}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={body.trim() ? colors.greenDark : colors.muted}
                />
              </Pressable>
            </BlurView>
          ) : (
            <BlurView
              intensity={80}
              tint="light"
              style={[styles.bottomBarOverlay, { paddingBottom: insets.bottom, height: bottomBarHeight }]}
            >
              <View style={styles.bottomBarRow}>
                <BouncePress style={styles.squareBtn} onPress={() => setShowCategory(true)} hitSlop={6}>
                  <CategoryIcon size={30} color={colors.black} />
                </BouncePress>

                <Pressable style={styles.floatingCommentBtn} onPress={openInput} hitSlop={12}>
                  <Ionicons name="chatbubble" size={20} color={colors.white} />
                </Pressable>

                <BouncePress style={styles.squareBtn} onPress={() => navigation.navigate("Create")} hitSlop={6}>
                  <CameraIcon size={30} color={colors.black} />
                </BouncePress>
              </View>
            </BlurView>
          )}
        </KeyboardAvoidingView>

        {/* Category Features Modal */}
        <CategoryModal
          visible={showCategory}
          onClose={() => setShowCategory(false)}
          onNavigate={(screen) => navigation.navigate(screen)}
        />
      </View>
    </FigmaLineBackground>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  flex: {
    flex: 1
  },

  // Header Overlay
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 56,
    position: "relative",
    width: "100%"
  },
  headerBtn: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.black,
    zIndex: 2
  },
  headerEllipsisBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    zIndex: 2
  },
  headerProfileBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    zIndex: 2
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    zIndex: 2
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.black
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
    zIndex: 2
  },

  // Post hero
  postHero: {
    height: 180,
    marginHorizontal: 12,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.canvasStrong
  },
  postHeroImage: {
    borderRadius: 20
  },
  scrollHeroContainer: {
    width: "100%",
    marginBottom: 8
  },
  engagementPillContainerScroll: {
    alignItems: "center",
    zIndex: 10,
    marginTop: -20
  },

  // Engagement Pill
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  statText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink
  },

  // Chat
  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 88, // Add padding bottom so comments can scroll past the bottom bar
    gap: 12
  },

  // Comment item layout
  commentItemRow: {
    flexDirection: "row",
    marginVertical: 6,
    width: "100%"
  },
  commentRightColumn: {
    flex: 1,
    gap: 4
  },
  commentAuthorName: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    paddingHorizontal: 4
  },
  commentMiddleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  commentBubbleContainer: {
    position: "relative",
    maxWidth: "80%"
  },
  commentBubble: {
    borderRadius: 20,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%"
  },
  commentBubbleText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20
  },
  commentTimeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginLeft: 10,
    marginRight: 10,
    alignSelf: "center"
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 2
  },
  commentMetaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: "underline"
  },
  commentLikeChipAbsolute: {
    position: "absolute",
    top: -6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10
  },
  commentLikeText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted
  },
  inlineAvatarWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    top: Platform.OS === "ios" ? 2 : 4
  },

  // Avatar
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.semibold
  },

  // Input bar
  inputBarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.05)"
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#F0F0EC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontFamily: fonts.regular,
    fontSize: IOS_MINIMUM_INPUT_FONT_SIZE,
    color: colors.ink
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECE9DF", // Circular light cream button
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  sendBtnDisabled: {
    opacity: 0.6
  },

  // Bottom Bar Overlay
  bottomBarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.05)",
    justifyContent: "center"
  },
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
    height: 64
  },
  squareBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  floatingCommentBtn: {
    width: 140,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6
  },

  // CategoryModal
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
