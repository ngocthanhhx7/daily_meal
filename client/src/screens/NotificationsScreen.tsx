import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Animated, FlatList, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useNotifications } from "../context/NotificationContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

type NotificationItem = {
  _id: string;
  type: "like" | "comment" | "follow" | "message";
  sender?: {
    _id?: string;
    id?: string;
    displayName?: string;
  } | null;
  post?: any;
  body: string;
  read: boolean;
  createdAt: string;
};

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
  const {
    notifications,
    unreadCount,
    webPushStatus,
    enableWebPushNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  } = useNotifications();
  const [enablingWebPush, setEnablingWebPush] = useState(false);

  function confirmDeleteAll() {
    if (notifications.length === 0) return;
    Alert.alert("Xóa tất cả thông báo?", "Thao tác này sẽ dọn sạch toàn bộ thông báo của bạn.", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa tất cả", style: "destructive", onPress: deleteAllNotifications }
    ]);
  }

  async function handleEnableWebPush() {
    setEnablingWebPush(true);
    try {
      await enableWebPushNotifications();
    } finally {
      setEnablingWebPush(false);
    }
  }

  function handleNotificationPress(notification: NotificationItem) {
    markAsRead(notification._id);

    if (notification.type === "follow") {
      const userId = notification.sender?._id ?? notification.sender?.id;
      if (userId) {
        navigation.navigate("PublicProfile", { userId });
      }
    } else if (notification.type === "message") {
      navigation.navigate("Inbox");
    } else if (notification.post) {
      navigation.navigate("Home", { postId: notification.post._id, targetPost: notification.post });
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
      </View>

      {webPushStatus !== "unsupported" && webPushStatus !== "ready" ? (
        <View style={styles.webPushBanner}>
          <Ionicons name="notifications" size={20} color={colors.greenDark} />
          <View style={styles.webPushCopy}>
            <AppText style={styles.webPushTitle}>Thông báo màn hình khóa</AppText>
            <AppText style={styles.webPushText}>
              {webPushStatus === "install-required"
                ? "Trên iPhone, hãy mở Daily Meal từ icon đã thêm vào Màn hình chính để nhận thông báo."
                : webPushStatus === "permission-denied"
                  ? "Bạn đã tắt quyền thông báo. Hãy bật lại trong cài đặt thông báo của iOS."
                  : webPushStatus === "missing-public-key"
                    ? "Server chưa cấu hình WEB_PUSH_VAPID_PUBLIC_KEY."
                    : "Bật thông báo để nhận tin nhắn mới trên màn hình khóa khi dùng web app."}
            </AppText>
          </View>
          {webPushStatus === "needs-permission" ? (
            <Pressable
              style={[styles.webPushButton, enablingWebPush && styles.webPushButtonDisabled]}
              onPress={handleEnableWebPush}
              disabled={enablingWebPush}
            >
              <AppText style={styles.webPushButtonText}>{enablingWebPush ? "Đang bật" : "Bật"}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Bulk Actions Bar */}
      {notifications.length > 0 && (
        <View style={styles.toolbarContainer}>
          <AppText style={styles.notificationCountText}>
            Bạn có <AppText style={styles.countHighlight}>{notifications.length}</AppText> thông báo
          </AppText>
          <View style={styles.toolbarActions}>
            {unreadCount > 0 ? (
              <Pressable style={styles.toolbarBtn} onPress={markAllAsRead} hitSlop={8}>
                <Ionicons name="checkmark-done-circle-outline" size={16} color={colors.greenDark} />
                <AppText style={styles.toolbarBtnText}>Đọc tất cả</AppText>
              </Pressable>
            ) : (
              <View style={styles.toolbarBtnDisabled}>
                <Ionicons name="checkmark-done-circle" size={16} color={colors.muted} />
                <AppText style={styles.toolbarBtnTextDisabled}>Đã đọc hết</AppText>
              </View>
            )}
            <Pressable style={styles.toolbarBtn} onPress={confirmDeleteAll} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <AppText style={[styles.toolbarBtnText, { color: colors.red }]}>Xóa tất cả</AppText>
            </Pressable>
          </View>
        </View>
      )}

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
            <SwipeDeleteItem onDelete={() => deleteNotification(item._id)}>
              <Pressable
                style={[styles.item, !item.read && styles.unreadItem]}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${iconColor}15` }]}>
                  <Ionicons name={iconName} size={18} color={iconColor} />
                </View>

                <View style={styles.contentWrap}>
                  <AppText style={styles.bodyText}>
                    <AppText style={styles.senderName}>{item.sender?.displayName ?? "Daily Meal"}</AppText>
                    {` ${
                      item.sender?.displayName && item.body.startsWith(item.sender.displayName)
                        ? item.body.slice(item.sender.displayName.length).trim()
                        : item.body
                    }`}
                  </AppText>
                  <AppText variant="caption" muted style={styles.timeText}>
                    {relativeTime(item.createdAt)}
                  </AppText>
                </View>

                <View style={styles.rightActions}>
                  {!item.read && <View style={styles.dot} />}
                  <Pressable
                    style={styles.cardDeleteBtn}
                    onPress={() => deleteNotification(item._id)}
                    hitSlop={12}
                  >
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </Pressable>
            </SwipeDeleteItem>
          );
        }}
      />
    </AppScreen>
  );
}

function SwipeDeleteItem({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [opened, setOpened] = useState(false);

  const close = React.useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => setOpened(false));
  }, [translateX]);

  const open = React.useCallback(() => {
    Animated.spring(translateX, { toValue: -84, useNativeDriver: true }).start(() => setOpened(true));
  }, [translateX]);

  const panResponder = React.useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_event, gesture) => {
        const nextX = Math.max(-96, Math.min(0, (opened ? -84 : 0) + gesture.dx));
        translateX.setValue(nextX);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx < -36 || (opened && gesture.dx < 24)) {
          open();
        } else {
          close();
        }
      }
    }),
    [close, open, opened, translateX]
  );

  const opacity = translateX.interpolate({
    inputRange: [-84, 0],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.deleteBehind, { opacity }]}>
        <Pressable style={styles.deleteAction} onPress={onDelete}>
          <Ionicons name="trash" size={20} color={colors.white} />
          <AppText style={styles.deleteText}>Xóa</AppText>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
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
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  webPushBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 12
  },
  webPushCopy: {
    flex: 1,
    gap: 2
  },
  webPushTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink
  },
  webPushText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted
  },
  webPushButton: {
    minWidth: 56,
    minHeight: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  webPushButtonDisabled: {
    opacity: 0.6
  },
  webPushButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white
  },
  listContainer: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 24
  },
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14
  },
  deleteBehind: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 84,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent"
  },
  deleteAction: {
    width: 72,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.red,
    borderRadius: 12,
    shadowColor: colors.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  deleteText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white
  },
  toolbarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  notificationCountText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted
  },
  countHighlight: {
    fontFamily: fonts.bold,
    color: colors.ink
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  toolbarBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.greenDark
  },
  toolbarBtnDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    opacity: 0.5
  },
  toolbarBtnTextDisabled: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted
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
    backgroundColor: "#F4F8F4" // Opaque light green to prevent delete button underneath from showing through
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
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4
  },
  cardDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${colors.line}50`,
    alignItems: "center",
    justifyContent: "center"
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
