import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";
import { FigmaLineBackground } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { ChatMessage, Conversation } from "../types/api";
import { IOS_MINIMUM_INPUT_FONT_SIZE, getKeyboardAvoidingBehavior } from "../utils/keyboardAvoidance";
import { appendUniqueMessage } from "./chatRealtime";
import { getParticipantAccent, getParticipantAvatarLabel } from "./messagePresentation";

function avatarSource(url?: string) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("http")) {
    return { uri: url };
  }

  return { uri: `${api.baseUrl}${url}` };
}

function formatChatTime(iso?: string) {
  if (!iso) return "";

  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return date.toLocaleTimeString("vi-VN", { hour: "numeric", minute: "2-digit" });
  }

  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

export function ChatScreen({ route, navigation }: any) {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const conversationId = route.params?.conversationId as string;
  const otherUser = route.params?.otherUser as Conversation["otherUser"] | undefined;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Real-time chat messages socket room integration
  useEffect(() => {
    if (!socket || !conversationId) return;

    console.log(`🔌 Subscribing to chat room: conversation:${conversationId}`);
    socket.emit("join-conversation", conversationId);

    socket.on("message:created", (newMessage: ChatMessage) => {
      console.log("💬 Live chat message received via socket:", newMessage);
      setMessages((current) => appendUniqueMessage(current, newMessage));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      console.log(`🚪 Unsubscribing from chat room: conversation:${conversationId}`);
      socket.emit("leave-conversation", conversationId);
      socket.off("message:created");
    };
  }, [socket, conversationId]);

  useEffect(() => {
    if (!token || !conversationId) {
      return;
    }

    api
      .conversationMessages(token, conversationId)
      .then((result) => {
        setMessages(result.messages);
      })
      .catch(() => undefined);
  }, [token, conversationId]);

  async function send() {
    const text = body.trim();

    if (!token || !conversationId || !text || sending) {
      return;
    }

    setSending(true);
    setBody("");
    try {
      const result = await api.sendMessage(token, conversationId, text);
      setMessages((current) => appendUniqueMessage(current, result.message));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      setBody(text);
      Alert.alert("Không thể gửi tin nhắn", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setSending(false);
    }
  }

  return (
    <FigmaLineBackground>
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={getKeyboardAvoidingBehavior(Platform.OS)}
        contentContainerStyle={styles.flex}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(116,143,115,0.92)", "rgba(116,143,115,0.82)", "rgba(116,143,115,0)"]}
          locations={[0, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={21} color={colors.green} />
          </Pressable>
          <AppText style={styles.headerTitle} numberOfLines={2}>
            {otherUser?.displayName ?? "Tin nhắn"}
          </AppText>
          <Ionicons name="chatbubble" size={54} color={colors.white} style={styles.headerChatIcon} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => {
          const mine = message.sender.id === user?.id;
          const timeLabel = formatChatTime(message.createdAt);

          return (
            <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
              {mine && timeLabel ? (
                <AppText style={[styles.messageTime, styles.messageTimeMine]}>{timeLabel}</AppText>
              ) : null}
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine ? (
                  <View
                    style={[
                      styles.messageAvatar,
                      { backgroundColor: getParticipantAccent(message.sender.id ?? message.sender.displayName) }
                    ]}
                  >
                    {avatarSource(message.sender.avatarUrl) ? (
                      <Image source={avatarSource(message.sender.avatarUrl)} style={styles.messageAvatarImage} />
                    ) : (
                      <AppText style={styles.messageAvatarText}>
                        {getParticipantAvatarLabel({
                          displayName: message.sender.displayName,
                          id: message.sender.id
                        })}
                      </AppText>
                    )}
                  </View>
                ) : null}
                <AppText style={mine ? styles.mineText : styles.theirsText}>{message.body}</AppText>
              </View>
              {!mine && timeLabel ? (
                <AppText style={styles.messageTime}>{timeLabel}</AppText>
              ) : null}
            </View>
          );
        })}
        {!messages.length ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.muted} />
            <AppText muted>Gửi lời chào hoặc hỏi công thức món ăn.</AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable style={[styles.sendButton, sending && styles.disabled]} onPress={send}>
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
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
  header: {
    minHeight: 188,
    paddingHorizontal: 36,
    paddingBottom: 34,
    justifyContent: "flex-start",
    overflow: "hidden"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 22,
    width: "100%"
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginTop: 13,
    flexShrink: 0
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 42,
    lineHeight: 50
  },
  headerChatIcon: {
    marginTop: 8,
    flexShrink: 0
  },
  messages: {
    flex: 1
  },
  messagesContent: {
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    maxWidth: "92%",
    alignSelf: "flex-start"
  },
  messageRowMine: {
    alignSelf: "flex-end"
  },
  messageAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden"
  },
  messageAvatarImage: {
    width: "100%",
    height: "100%"
  },
  messageAvatarText: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 11
  },
  bubble: {
    maxWidth: "100%",
    flexShrink: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  mine: {
    backgroundColor: colors.white,
    borderBottomRightRadius: 7
  },
  theirs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#C3D0BE",
    paddingLeft: 8,
    borderBottomLeftRadius: 7
  },
  mineText: {
    color: colors.ink
  },
  theirsText: {
    color: colors.ink
  },
  messageTime: {
    color: "rgba(116,116,111,0.46)",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
    flexShrink: 0
  },
  messageTimeMine: {
    textAlign: "right"
  },
  emptyChat: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 18
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 14,
    paddingTop: 8
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0EC",
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: IOS_MINIMUM_INPUT_FONT_SIZE
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  disabled: {
    opacity: 0.55
  }
});
