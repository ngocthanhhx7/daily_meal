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
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";

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

function avatarInitial(name?: string) {
  return name?.slice(0, 1)?.toUpperCase() ?? "D";
}

function imageSource(post?: Post) {
  const first = post?.images?.[0]?.url;
  if (!first) return require("../../assets/figma-snapshots/image3.png");
  if (first.startsWith("http")) return { uri: first };
  return { uri: `${api.baseUrl}${first}` };
}

// --- Avatar ---
function Avatar({ name, size = 36, bg }: { name?: string; size?: number; bg?: string }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? colors.green }
      ]}
    >
      <AppText style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {avatarInitial(name)}
      </AppText>
    </View>
  );
}

// --- Bubble ---
function CommentBubble({
  comment,
  isMine
}: {
  comment: Comment;
  isMine: boolean;
}) {
  const bubbleBg = isMine ? colors.yellow : colors.green;
  const textColor = isMine ? colors.ink : colors.white;

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isMine && (
        <Avatar name={comment.author?.displayName} size={34} bg={colors.greenDark} />
      )}

      <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        {!isMine && (
          <AppText variant="caption" style={styles.bubbleAuthor} numberOfLines={1}>
            {comment.author?.displayName ?? "Daily Meal"}
          </AppText>
        )}

        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          <AppText style={[styles.bubbleText, { color: textColor }]}>
            {comment.body}
          </AppText>
        </View>

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
        <Avatar name={comment.author?.displayName} size={34} bg={colors.blue} />
      )}
    </View>
  );
}

// --- Main Screen ---
export function CommentsScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const post: Post | undefined = route.params?.post;
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const totalLikes = post?.stats?.likes ?? 48;
  const totalComments = comments.length || post?.stats?.comments || 0;

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

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background2.png")}
      style={styles.background}
      resizeMode="cover"
    >
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={0}
      >
        {/* ── HEADER ── */}
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
            <Avatar name={post?.author?.displayName ?? ""} size={30} />
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.muted} />
              <AppText variant="caption" muted>{totalComments}</AppText>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={14} color={colors.red} />
              <AppText variant="caption" muted>{totalLikes}</AppText>
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
          {comments.map((comment) => {
            const isMine = comment.author?.id === user?.id;
            return (
              <CommentBubble key={comment._id} comment={comment} isMine={isMine} />
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
    </ImageBackground>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8
  },
  headerRight: {
    flexDirection: "row",
    gap: 2
  },

  // Post strip
  postStrip: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    alignItems: "center",
    paddingVertical: 10,
    gap: 8
  },
  postThumb: {
    width: "92%",
    height: 90,
    borderRadius: 10,
    backgroundColor: colors.canvasStrong
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },

  // Chat
  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10
  },

  // Bubble row
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "88%"
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
    flex: 1
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
    paddingVertical: 10
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
    flexShrink: 0
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.semibold
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.canvas,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  sendBtnDisabled: {
    backgroundColor: colors.canvasStrong
  }
});
