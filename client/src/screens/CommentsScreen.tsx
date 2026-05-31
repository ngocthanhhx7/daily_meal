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
  View
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
import { getParticipantAccent, getParticipantAvatarLabel, isDoubleTap } from "./messagePresentation";

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
  const bubbleBg = isMine ? colors.yellow : colors.green;
  const textColor = isMine ? colors.ink : colors.white;

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
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isMine && (
        <Avatar
          name={comment.author?.displayName}
          id={comment.author?.id}
          avatarUrl={comment.author?.avatarUrl}
          size={34}
        />
      )}

      <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        {!isMine && (
          <AppText variant="caption" style={styles.bubbleAuthor} numberOfLines={1}>
            {comment.author?.displayName ?? "Daily Meal"}
          </AppText>
        )}

        <Pressable onPress={handleBubblePress} style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          <AppText style={[styles.bubbleText, { color: textColor }]}>
            {comment.body}
          </AppText>
        </Pressable>

        <View style={[styles.bubbleMeta, isMine && styles.bubbleMetaRight]}>
          <AppText variant="caption" muted>
            {relativeTime(comment.createdAt)}
          </AppText>
          <Pressable hitSlop={8}>
            <AppText variant="caption" muted>
              Trả lời
            </AppText>
          </Pressable>
          {(comment.likes ?? 0) > 0 && (
            <View style={styles.likeChip}>
              <AppText variant="caption" style={styles.likeChipText}>
                {comment.likes}
              </AppText>
              <Ionicons name="heart" size={10} color={colors.red} />
            </View>
          )}
        </View>
      </View>

      {isMine && (
        <Avatar
          name={comment.author?.displayName}
          id={comment.author?.id}
          avatarUrl={comment.author?.avatarUrl}
          size={34}
          bg={colors.black}
        />
      )}
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
  const scrollRef = useRef<ScrollView>(null);

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
        setComments((c) => [...c, result.comment as Comment]);
      } else {
        setComments((c) => [...c, newComment]);
      }

      setBody("");
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
        behavior={Platform.select({ ios: "padding", android: undefined })}
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
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <AppText variant="subtitle" style={styles.headerTitle}>
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

        {/* ── POST PREVIEW STRIP ── */}
        <View style={styles.postStrip}>
          <Image source={imageSource(post)} style={styles.postThumb} resizeMode="cover" />
          <View style={styles.statsRow}>
            <Avatar
              name={post?.author?.displayName ?? ""}
              id={post?.author?.id}
              avatarUrl={post?.author?.avatarUrl}
              size={30}
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
        </ImageBackground>

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
        </ScrollView>

        {/* ── INPUT BAR ── */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
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
              color={body.trim() ? colors.white : colors.muted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </FigmaLineBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
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
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.82)"
  },
  headerTitle: {
    position: "absolute",
    left: 88,
    right: 88,
    textAlign: "center",
    color: colors.ink
  },
  headerRight: {
    flexDirection: "row",
    gap: 2
  },

  // Post hero
  postHero: {
    height: 148,
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 10,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.canvasStrong
  },
  postHeroImage: {
    borderRadius: 10
  },
  postHeroShade: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  postStrip: {
    alignItems: "center",
    paddingBottom: 10,
    gap: 8
  },
  postThumb: {
    display: "none"
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)"
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  statText: {
    color: colors.ink
  },

  // Chat
  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12
  },

  // Bubble row
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "92%"
  },
  bubbleLeft: {
    alignSelf: "flex-start"
  },
  bubbleRight: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse"
  },

  // Bubble wrap
  bubbleWrap: {
    gap: 4,
    flexShrink: 1
  },
  bubbleWrapLeft: {
    alignItems: "flex-start"
  },
  bubbleWrapRight: {
    alignItems: "flex-end"
  },

  bubbleAuthor: {
    color: colors.muted,
    paddingHorizontal: 2
  },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: 250
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.regular
  },

  // Bubble meta
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4
  },
  bubbleMetaRight: {
    flexDirection: "row-reverse"
  },
  likeChip: {
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
  likeChipText: {
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
    fontSize: 14,
    color: colors.ink
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  sendBtnDisabled: {
    backgroundColor: colors.canvasStrong
  }
});
