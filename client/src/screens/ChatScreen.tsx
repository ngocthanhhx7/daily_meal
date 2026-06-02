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
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={getKeyboardAvoidingBehavior(Platform.OS)}
        contentContainerStyle={styles.flex}
        keyboardVerticalOffset={0}
      >
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: getParticipantAccent(otherUser?.id ?? otherUser?.displayName) }]}>
          {avatarSource(otherUser?.avatarUrl) ? (
            <Image source={avatarSource(otherUser?.avatarUrl)} style={styles.avatarImage} />
          ) : (
            <AppText variant="button" style={styles.avatarText}>
              {getParticipantAvatarLabel({ displayName: otherUser?.displayName, id: otherUser?.id })}
            </AppText>
          )}
        </View>
        <View style={styles.headerText}>
          <AppText variant="button" numberOfLines={1}>
            {otherUser?.displayName ?? "Tin nhắn"}
          </AppText>
          <AppText variant="caption" muted>
            Daily Meal chat
          </AppText>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((message) => {
          const mine = message.sender.id === user?.id;

          return (
            <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
              {!mine && (
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
              )}
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <AppText style={mine ? styles.mineText : undefined}>{message.body}</AppText>
            </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)"
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.green
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: colors.white
  },
  headerText: {
    flex: 1
  },
  messages: {
    flex: 1
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    maxWidth: "86%",
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
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  mine: {
    backgroundColor: colors.black,
    borderBottomRightRadius: 7
  },
  theirs: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 7
  },
  mineText: {
    color: colors.white
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
