import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { AppButton } from "../components/AppButton";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export function SupportScreen({ navigation }: any) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendFeedback() {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ tiêu đề và nội dung.");
      return;
    }

    setLoading(true);
    // Simulating sending feedback
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        "Đã gửi phản hồi",
        "Cảm ơn đóng góp của bạn! Đội ngũ Daily Meal sẽ phản hồi sớm nhất qua email của bạn.",
        [
          {
            text: "Đồng ý",
            onPress: () => {
              setSubject("");
              setMessage("");
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
        <AppText variant="title" style={styles.headerTitle}>Hỗ trợ</AppText>
      </View>

      {/* FAQ block */}
      <View style={styles.faqSection}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Câu hỏi thường gặp (FAQs)
        </AppText>

        <View style={styles.faqItem}>
          <AppText style={styles.faqQuestion}>1. Làm thế nào để thêm Locket Widget trên iOS?</AppText>
          <AppText style={styles.faqAnswer}>
            Nhấn giữ màn hình chính của iPhone → Chọn dấu "+" ở góc trái → Tìm "Daily Meal" và chọn Thêm tiện ích (Add Widget).
          </AppText>
        </View>

        <View style={styles.faqItem}>
          <AppText style={styles.faqQuestion}>2. Làm sao để chia sẻ tài khoản?</AppText>
          <AppText style={styles.faqAnswer}>
            Bạn hãy nâng cấp gói Daily Premium để kích hoạt mã chia sẻ cho gia đình và bạn bè dùng chung quyền lợi!
          </AppText>
        </View>
      </View>

      {/* Feedback Form */}
      <View style={styles.formSection}>
        <AppText variant="caption" muted style={styles.sectionLabel}>
          Gửi phản hồi cho chúng tôi
        </AppText>

        <TextField
          label="Tiêu đề"
          value={subject}
          onChangeText={setSubject}
          placeholder="VD: Lỗi kết nối tài khoản"
        />

        <TextField
          label="Nội dung"
          value={message}
          onChangeText={setMessage}
          placeholder="Mô tả chi tiết vấn đề hoặc ý kiến của bạn..."
          multiline
          numberOfLines={4}
        />

        <AppButton
          label="Gửi phản hồi"
          onPress={handleSendFeedback}
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
  faqSection: {
    gap: 12
  },
  sectionLabel: {
    textTransform: "none",
    fontSize: 13,
    marginBottom: 4
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    gap: 6
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted
  },
  formSection: {
    gap: 14,
    marginTop: 10
  }
});
