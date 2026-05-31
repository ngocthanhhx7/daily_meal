import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useNotifications } from "../context/NotificationContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

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

export function NotificationsScreen({ navigation }: any) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  function handleNotificationPress(notification: any) {
    markAsRead(notification._id);
    
    if (notification.type === "follow") {
      navigation.navigate("PublicProfile", { userId: notification.sender._id });
    } else if (notification.type === "message") {
      navigation.navigate("Inbox");
    } else if (notification.post) {
      navigation.navigate("Comments", { post: notification.post });
    }
  }

  return (
    <AppScreen scroll={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Thông báo</AppText>
        
        {unreadCount > 0 && (
          <Pressable style={styles.markAllBtn} onPress={markAllAsRead}>
            <Ionicons name="checkmark-done" size={20} color={colors.greenDark} />
          </Pressable>
        )}
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.muted} />
            <AppText style={styles.emptyTitle}>Hộp thư trống</AppText>
            <AppText style={styles.emptySubtitle} muted>
              Bạn chưa nhận được thông báo nào. Mọi hoạt động của bạn bè sẽ hiển thị tại đây!
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "information-circle-outline";
          let iconColor = colors.ink;

          if (item.type === "like") {
            iconName = "heart";
            iconColor = colors.red;
          } else if (item.type === "comment") {
            iconName = "chatbubble";
            iconColor = colors.greenDark;
          } else if (item.type === "follow") {
            iconName = "person-add";
            iconColor = colors.green;
          } else if (item.type === "message") {
            iconName = "mail";
            iconColor = colors.yellow;
          }

          return (
            <Pressable
              style={[styles.item, !item.read && styles.unreadItem]}
              onPress={() => handleNotificationPress(item)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={iconName} size={18} color={iconColor} />
              </View>

              <View style={styles.contentWrap}>
                <AppText style={styles.bodyText}>
                  <AppText style={styles.senderName}>{item.sender.displayName}</AppText>
                  {` ${
                    item.body.startsWith(item.sender.displayName)
                      ? item.body.slice(item.sender.displayName.length).trim()
                      : item.body
                  }`}
                </AppText>
                <AppText variant="caption" muted style={styles.timeText}>
                  {relativeTime(item.createdAt)}
                </AppText>
              </View>

              {!item.read && <View style={styles.dot} />}
            </Pressable>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1
  },
  markAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  listContainer: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 24
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  unreadItem: {
    borderColor: colors.greenDark,
    backgroundColor: `${colors.green}05`
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  contentWrap: {
    flex: 1,
    gap: 2
  },
  senderName: {
    fontFamily: fonts.bold,
    color: colors.ink
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink
  },
  timeText: {
    fontSize: 12
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.greenDark
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingVertical: 120,
    gap: 14
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.muted
  }
});
