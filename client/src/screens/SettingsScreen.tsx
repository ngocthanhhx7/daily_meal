import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { getGoogleIdToken } from "../services/googleSignIn";
import { colors } from "../theme/colors";

export function SettingsScreen({ navigation }: any) {
  const { signOut, linkGoogle } = useAuth();

  function handleLogout() {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: signOut }
    ]);
  }

  async function handleLinkGoogle() {
    try {
      const idToken = await getGoogleIdToken();
      await linkGoogle(idToken);
      Alert.alert("Đã liên kết Google", "Bạn có thể đăng nhập bằng Google từ lần sau.");
    } catch (error) {
      Alert.alert("Không thể liên kết Google", error instanceof Error ? error.message : "Thử lại sau");
    }
  }

  return (
    <AppScreen>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Cài đặt</AppText>
        <Pressable style={styles.menuButton} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.black} />
        </Pressable>
      </View>

      {/* Section: Tài khoản của bạn */}
      <View style={styles.section}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Tài khoản của bạn
        </AppText>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Ionicons name="person" size={18} color={colors.black} />
          <AppText style={styles.rowText}>Trung tâm tài khoản</AppText>
        </Pressable>
        <Pressable style={styles.rowPremium} onPress={() => navigation.navigate("PremiumBenefits")}>
          <AppText style={styles.rowText}>Daily premium</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={handleLinkGoogle}>
          <Ionicons name="logo-google" size={18} color={colors.black} />
          <AppText style={styles.rowText}>Liên kết Google</AppText>
        </Pressable>
      </View>

      {/* Section: Cách bạn dùng Daily Meal */}
      <View style={styles.section}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Cách bạn dùng Daily Meal
        </AppText>
        <Pressable style={styles.row} onPress={() => navigation.navigate("Saved")}>
          <Ionicons name="bookmark" size={18} color={colors.black} />
          <AppText style={styles.rowText}>Đã lưu</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate("Notifications")}>
          <AppText style={styles.rowText}>Thông báo</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={() => Alert.alert("Theo dõi tiến độ", "Hệ thống sẽ tự động nhắc nhở khi đến giờ đăng bài ăn uống hàng ngày!")}>
          <AppText style={styles.rowText}>Theo dõi tiến độ đăng bài</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate("Blocked")}>
          <Ionicons name="ban-outline" size={18} color={colors.black} />
          <AppText style={styles.rowText}>Đã chặn</AppText>
        </Pressable>
      </View>

      {/* Standalone items */}
      <View style={styles.section}>
        <Pressable style={styles.row} onPress={() => navigation.navigate("Support")}>
          <AppText style={styles.rowText}>Hỗ trợ</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate("ShareAccount")}>
          <AppText style={styles.rowText}>Chia sẻ tài khoản</AppText>
        </Pressable>
        <Pressable style={styles.rowLogout} onPress={handleLogout}>
          <AppText style={styles.logoutText}>Đăng xuất</AppText>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate("PremiumBenefits")}>
          <AppText style={styles.rowText}>Quyền lợi</AppText>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    gap: 8
  },
  sectionLabel: {
    marginBottom: 2,
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 13
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  rowPremium: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.yellow
  },
  rowLogout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.yellow
  },
  rowText: {
    fontSize: 15,
    color: colors.ink
  },
  logoutText: {
    fontSize: 15,
    color: colors.red,
    fontWeight: "600"
  }
});
