import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme/colors";

export function BlockedScreen({ navigation }: any) {
  const { token } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .getBlockedUsers(token)
      .then((result) => setBlockedUsers(result.users))
      .catch((err) => console.error("Failed to fetch blocked users:", err))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleUnblock(userId: string, displayName: string) {
    if (!token) return;

    Alert.alert("Bỏ chặn", `Bạn có chắc muốn bỏ chặn người dùng ${displayName}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Bỏ chặn",
        style: "default",
        onPress: async () => {
          try {
            await api.removeUserInteraction(token, userId, "block");
            setBlockedUsers((current) => current.filter((u) => u.id !== userId));
            Alert.alert("Thành công", `Đã bỏ chặn ${displayName}.`);
          } catch (err) {
            Alert.alert("Lỗi", "Không thể bỏ chặn lúc này, vui lòng thử lại.");
          }
        }
      }
    ]);
  }

  return (
    <AppScreen scroll={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Đã chặn</AppText>
      </View>

      {/* List */}
      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.muted} />
            <AppText style={styles.emptyTitle}>Danh sách trống</AppText>
            <AppText style={styles.emptySubtitle} muted>
              Bạn chưa chặn người dùng nào. Danh sách người dùng bị bạn chặn sẽ hiển thị ở đây!
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>
                {item.displayName?.slice(0, 1)?.toUpperCase() ?? "U"}
              </AppText>
            </View>

            <View style={styles.info}>
              <AppText style={styles.nameText}>{item.displayName}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {item.email || "Không có email"}
              </AppText>
            </View>

            <Pressable style={styles.unblockBtn} onPress={() => handleUnblock(item.id, item.displayName)}>
              <AppText style={styles.unblockBtnText}>Bỏ chặn</AppText>
            </Pressable>
          </View>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16
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
    padding: 14
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.canvasStrong,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontWeight: "bold",
    color: colors.muted
  },
  info: {
    flex: 1,
    gap: 2
  },
  nameText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink
  },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.yellow
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.red
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
    fontWeight: "bold",
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
