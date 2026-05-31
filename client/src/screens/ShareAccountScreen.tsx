import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Clipboard, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { AppButton } from "../components/AppButton";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export function ShareAccountScreen({ navigation }: any) {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Hardcoded premium share code for premium users, otherwise request upgrade
  const isPremium = user?.isPremium || false;
  const myShareCode = isPremium ? "DMEAL-FAMILY-99X" : "NÂNG CẤP PREMIUM ĐỂ LẤY MÃ";

  function handleCopyCode() {
    if (!isPremium) {
      Alert.alert("Daily Premium", "Vui lòng nâng cấp tài khoản Premium để sử dụng tính năng này!");
      return;
    }
    Clipboard.setString(myShareCode);
    Alert.alert("Đã sao chép", "Đã sao chép mã chia sẻ của bạn vào khay nhớ tạm!");
  }

  async function handleJoinFamily() {
    if (!inviteCode.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã chia sẻ để tham gia.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        "Tham gia thành công",
        "Bạn đã tham gia nhóm gia đình Daily Meal thành công và nhận đầy đủ quyền lợi Premium!",
        [
          {
            text: "Tuyệt vời",
            onPress: () => {
              setInviteCode("");
              navigation.goBack();
            }
          }
        ]
      );
    }, 1200);
  }

  return (
    <AppScreen keyboard>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Chia sẻ tài khoản</AppText>
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Ionicons name="people" size={32} color={colors.greenDark} />
        <AppText style={styles.cardTitle}>Nhóm Gia Đình Daily Meal</AppText>
        <AppText style={styles.cardDesc}>
          Tính năng này cho phép bạn chia sẻ tài khoản Premium với tối đa 5 thành viên trong gia đình để cùng nhau chia sẻ công thức và lưu trữ khoảnh khắc!
        </AppText>
      </View>

      {/* Section 1: My share code */}
      <View style={styles.section}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Mã chia sẻ của bạn
        </AppText>

        <Pressable style={[styles.codeBox, !isPremium && styles.codeBoxDisabled]} onPress={handleCopyCode}>
          <AppText style={[styles.codeText, !isPremium && styles.codeTextDisabled]}>
            {myShareCode}
          </AppText>
          {isPremium && <Ionicons name="copy-outline" size={18} color={colors.greenDark} />}
        </Pressable>

        <AppText variant="caption" muted style={styles.hintText}>
          {isPremium 
            ? "Nhấp vào mã trên để sao chép và gửi cho người thân của bạn." 
            : "Nâng cấp lên Daily Premium để tạo mã chia sẻ tài khoản với người thân."}
        </AppText>
      </View>

      {/* Section 2: Enter code to join */}
      <View style={styles.section}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Nhập mã chia sẻ được tặng
        </AppText>

        <TextField
          label="Mã gia đình"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="VD: DMEAL-XXXXXX"
          autoCapitalize="characters"
        />

        <AppButton
          label="Tham gia nhóm"
          onPress={handleJoinFamily}
          loading={loading}
        />
      </View>
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
  infoCard: {
    backgroundColor: `${colors.green}10`,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted
  },
  section: {
    gap: 10
  },
  sectionLabel: {
    textTransform: "none",
    fontSize: 13
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.greenDark,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  codeBoxDisabled: {
    borderColor: colors.line,
    backgroundColor: colors.canvasStrong
  },
  codeText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.greenDark
  },
  codeTextDisabled: {
    color: colors.muted,
    fontSize: 14
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16
  }
});
