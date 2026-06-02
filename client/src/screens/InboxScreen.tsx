import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { colors } from "../theme/colors";
import type { Conversation } from "../types/api";
import { upsertRealtimeConversation } from "./inboxRealtime";

function avatarSource(url?: string) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("http")) {
    return { uri: url };
  }

  return { uri: `${api.baseUrl}${url}` };
}

export function InboxScreen({ navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    api
      .conversations(token)
      .then((result) => setConversations(result.conversations))
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleConversationUpdated = (conversation: Conversation) => {
      setConversations((current) => upsertRealtimeConversation(current, conversation));
    };

    socket.on("conversation:updated", handleConversationUpdated);

    return () => {
      socket.off("conversation:updated", handleConversationUpdated);
    };
  }, [socket]);

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <View style={styles.headerText}>
          <AppText variant="title">Tin nhắn</AppText>
          <AppText muted>Các cuộc trò chuyện trong Daily Meal.</AppText>
        </View>
      </View>

      {conversations.length ? (
        conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            style={styles.row}
            onPress={() =>
              navigation.navigate("Chat", {
                conversationId: conversation.id,
                otherUser: conversation.otherUser
              })
            }
          >
            <View style={styles.avatar}>
              {avatarSource(conversation.otherUser.avatarUrl) ? (
                <Image source={avatarSource(conversation.otherUser.avatarUrl)} style={styles.avatarImage} />
              ) : (
                <AppText variant="button" style={styles.avatarText}>
                  {conversation.otherUser.displayName.slice(0, 1).toUpperCase()}
                </AppText>
              )}
            </View>
            <View style={styles.copy}>
              <AppText variant="button" numberOfLines={1}>
                {conversation.otherUser.displayName}
              </AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {conversation.lastMessage?.body || "Bắt đầu cuộc trò chuyện"}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="Chưa có tin nhắn"
          message="Mở trang cá nhân người khác và nhấn Nhắn tin để bắt đầu."
          icon="chatbubble-ellipses-outline"
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
  headerText: {
    flex: 1
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  copy: {
    flex: 1
  }
});
