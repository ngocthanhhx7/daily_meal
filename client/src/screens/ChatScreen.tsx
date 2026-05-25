import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { ChatMessage, Conversation } from "../types/api";

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
  const conversationId = route.params?.conversationId as string;
  const otherUser = route.params?.otherUser as Conversation["otherUser"] | undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token || !conversationId) {
      return;
    }

    api
      .conversationMessages(token, conversationId)
      .then((result) => setMessages(result.messages))
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
      setMessages((current) => [...current, result.message]);
    } catch (error) {
      setBody(text);
      Alert.alert("Không thể gửi tin nhắn", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppScreen keyboard>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <View style={styles.avatar}>
          {avatarSource(otherUser?.avatarUrl) ? (
            <Image source={avatarSource(otherUser?.avatarUrl)} style={styles.avatarImage} />
          ) : (
            <AppText variant="button" style={styles.avatarText}>
              {otherUser?.displayName?.slice(0, 1).toUpperCase() ?? "D"}
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

      <View style={styles.messages}>
        {messages.map((message) => {
          const mine = message.sender.id === user?.id;

          return (
            <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <AppText style={mine ? styles.mineText : undefined}>{message.body}</AppText>
            </View>
          );
        })}
        {!messages.length ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.muted} />
            <AppText muted>Gửi lời chào hoặc hỏi công thức món ăn.</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.composer}>
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
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
    flex: 1,
    gap: 8,
    justifyContent: "flex-end"
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: colors.black
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  mineText: {
    color: colors.white
  },
  emptyChat: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 8
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 38,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  disabled: {
    opacity: 0.55
  }
});
