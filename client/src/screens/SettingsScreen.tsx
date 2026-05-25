import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { colors } from "../theme/colors";

const items: Array<{
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
}> = [
  {
    title: "Tài khoản",
    body: "Chỉnh sửa hồ sơ, avatar, ảnh bìa và thông tin cá nhân.",
    icon: "person-circle-outline",
    route: "EditProfile"
  },
  {
    title: "Bảo mật",
    body: "Đổi mật khẩu email/password của Daily Meal.",
    icon: "lock-closed-outline",
    route: "ChangePassword"
  },
  {
    title: "Tin nhắn",
    body: "Quản lý các cuộc trò chuyện với người dùng khác.",
    icon: "chatbubble-ellipses-outline",
    route: "Inbox"
  },
  {
    title: "Premium",
    body: "Sticker VIP và giới hạn upload cao hơn đang là cờ phát triển.",
    icon: "star-outline"
  },
  {
    title: "Quyền riêng tư",
    body: "Hạn chế, chặn và báo cáo được lưu để xử lý trong giai đoạn sau.",
    icon: "shield-checkmark-outline"
  },
  {
    title: "Điều khoản",
    body: "Thông tin dinh dưỡng chỉ là ước tính, không thay thế tư vấn chuyên môn.",
    icon: "document-text-outline"
  }
];

export function SettingsScreen({ navigation }: any) {
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title">Cài đặt</AppText>
          <AppText muted>Quản lý tài khoản Daily Meal.</AppText>
        </View>
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.title}
            style={styles.item}
            onPress={item.route ? () => navigation.navigate(item.route) : undefined}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={20} color={colors.black} />
            </View>
            <View style={styles.itemCopy}>
              <AppText variant="button">{item.title}</AppText>
              <AppText variant="caption" muted>
                {item.body}
              </AppText>
            </View>
            {item.route ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
          </Pressable>
        ))}
      </View>
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
  headerCopy: {
    flex: 1
  },
  list: {
    gap: 10
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas
  },
  itemCopy: {
    flex: 1,
    gap: 3
  }
});
