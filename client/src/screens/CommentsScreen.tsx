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
  LayoutAnimation,
  UIManager
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { FigmaLineBackground } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { IOS_MINIMUM_INPUT_FONT_SIZE, getKeyboardAvoidingBehavior } from "../utils/keyboardAvoidance";
import { getParticipantAccent, getParticipantAvatarLabel, isDoubleTap } from "./messagePresentation";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

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

// --- Bubble ---
function CommentBubble({
  comment,
  isMine,
  onDoubleLike
}: {
  comment: Comment;
  isMine: boolean;
  onDoubleLike: (commentId: string) => void;
}) {
  const lastTapRef = useRef<number | undefined>(undefined);
  const bubbleBg = isMine ? colors.greenDark : colors.green; // Mine is dark green, other is soft green
  const textColor = colors.white;

  function handleBubblePress() {
    const now = Date.now();
    if (isDoubleTap(lastTapRef.current, now)) {
      onDoubleLike(comment._id);
      lastTapRef.current = undefined;
      return;
    }

    lastTapRef.current = now;
  }

  return (
    <View style={styles.commentItemRow}>
      {/* Left Column: holds avatar pushed down to align with bubble */}
      <View style={styles.commentLeftColumn}>
        <Avatar
          name={comment.author?.displayName}
          id={comment.author?.id}
          avatarUrl={comment.author?.avatarUrl}
          size={36}
        />
      </View>

      {/* Right Column: Name, Bubble, Metadata */}
      <View style={styles.commentRightColumn}>
        <AppText style={styles.commentAuthorName}>
          {comment.author?.displayName ?? "Daily Meal"}
        </AppText>

        <Pressable onPress={handleBubblePress} style={[styles.commentBubble, { backgroundColor: bubbleBg }]}>
          <AppText style={[styles.commentBubbleText, { color: textColor }]}>
            {comment.body}
          </AppText>
        </Pressable>

        <View style={styles.commentMetaRow}>
          <AppText variant="caption" muted style={styles.commentMetaText}>
            {relativeTime(comment.createdAt)}
          </AppText>
          <Pressable hitSlop={8}>
            <AppText variant="caption" muted style={styles.commentMetaText}>
              Trả lời
            </AppText>
          </Pressable>
          {(comment.likes ?? 0) > 0 && (
            <View style={styles.commentLikeChip}>
              <AppText variant="caption" style={styles.commentLikeText}>
                {comment.likes}
              </AppText>
              <Ionicons name="heart" size={10} color={colors.red} />
            </View>
          )}
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
  const [isInputVisible, setIsInputVisible] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const totalLikes = post?.stats?.likes ?? 48;
  const totalComments = comments.length || post?.stats?.comments || 0;

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

  // Handle keyboard hide to return to floating button state
  useEffect(() => {
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsInputVisible(false);
    });
    return () => {
      hideSubscription.remove();
    };
  }, []);

  // Autofocus input when it becomes visible
  useEffect(() => {
    if (isInputVisible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInputVisible]);

  function openInput() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsInputVisible(true);
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsInputVisible(false);
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
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={getKeyboardAvoidingBehavior(Platform.OS)}
          contentContainerStyle={styles.flex}
          keyboardVerticalOffset={0}
        >
          {/* ── HEADER ── */}
          <ImageBackground
            source={imageSource(post)}
            style={styles.postHero}
            imageStyle={styles.postHeroImage}
            resizeMode="cover"
          >
            <View style={styles.postHeroShade}>
              <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={colors.ink} />
                </Pressable>
                <AppText style={styles.headerTitle}>
                  Bình luận
                </AppText>
                <View style={styles.headerRight}>
                  <Pressable style={styles.headerBtn} hitSlop={8}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink} />
                  </Pressable>
                  <Pressable style={styles.headerBtn} hitSlop={8}>
                    <Ionicons name="person-outline" size={20} color={colors.ink} />
                  </Pressable>
                </View>
              </View>
            </View>
          </ImageBackground>

          {/* ── ENGAGEMENT PILL ── */}
          <View style={styles.engagementPillContainer}>
            <View style={styles.statsRow}>
              {/* Green circle avatar with initial "K" or author avatar */}
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

          {/* ── CHAT BUBBLES ── */}
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            <Pressable onPress={Keyboard.dismiss} style={{ gap: 12, width: "100%" }}>
              {comments.map((comment) => {
                const isMine = comment.author?.id === user?.id;
                return (
                  <CommentBubble
                    key={comment._id}
                    comment={comment}
                    isMine={isMine}
                    onDoubleLike={likeComment}
                  />
                );
              })}
            </Pressable>
          </ScrollView>

          {/* ── BOTTOM ACTIONS (FLOATING BUTTON OR INPUT BAR) ── */}
          {isInputVisible ? (
            <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
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
            </View>
          ) : (
            <View style={[styles.floatingBtnContainer, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable style={styles.floatingCommentBtn} onPress={openInput} hitSlop={12}>
                <Ionicons name="chatbubble" size={20} color={colors.white} />
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FigmaLineBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  flex: {
    flex: 1
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    position: "relative",
    width: "100%"
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    zIndex: 2
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 18,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.black,
    zIndex: 1
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
  postHeroShade: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.15)"
  },

  // Engagement Pill
  engagementPillContainer: {
    alignItems: "center",
    zIndex: 10,
    marginTop: -20,
    marginBottom: 8
  },
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
    paddingBottom: 88, // Add padding bottom so comments can scroll past the floating button
    gap: 12
  },

  // Comment item layout
  commentItemRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginVertical: 4,
    width: "100%"
  },
  commentLeftColumn: {
    paddingTop: 18, // Pushes avatar down past the author name to align with the bubble
    alignItems: "center"
  },
  commentRightColumn: {
    flex: 1,
    gap: 4
  },
  commentAuthorName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted,
    paddingLeft: 4
  },
  commentBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
    maxWidth: "85%"
  },
  commentBubbleText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 6,
    marginTop: 2
  },
  commentMetaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted
  },
  commentLikeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line
  },
  commentLikeText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted
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
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.94)"
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

  // Floating comment button
  floatingBtnContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    pointerEvents: "box-none"
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
  }
});
