import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { getPwaEnvironment } from "./platform";

const steps = [
  { number: "1", title: "Nhấn nút Chia sẻ", detail: "Trong thanh công cụ Safari, chạm biểu tượng chia sẻ." },
  { number: "2", title: "Chọn Thêm vào Màn hình chính", detail: "Kéo danh sách hành động nếu bạn chưa thấy lựa chọn này." },
  { number: "3", title: "Mở Daily Meal từ icon mới", detail: "Sau khi thêm, quay về Home Screen và mở Daily Meal như một ứng dụng." }
];

export function IosInstallGate() {
  const environment = getPwaEnvironment();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      bounces={false}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>DM</Text>
      </View>

      <Text style={styles.title}>Cài Daily Meal trên iPhone</Text>
      <Text style={styles.subtitle}>
        Để dùng Daily Meal toàn màn hình như ứng dụng, hãy thêm vào Màn hình chính trước khi tiếp tục.
      </Text>

      <View style={styles.phoneHint}>
        <Text style={styles.shareSymbol}>□↑</Text>
        <Text style={styles.phoneHintText}>Safari → Chia sẻ → Thêm vào Màn hình chính</Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.number} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.number}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {environment.isIosInAppBrowser ? (
        <Text style={styles.warning}>
          Nếu bạn đang mở từ Facebook, Instagram hoặc Zalo, hãy mở liên kết này bằng Safari trước.
        </Text>
      ) : null}

      <Text style={styles.footer}>
        Sau khi mở bằng icon trên Home Screen, màn hình này sẽ tự biến mất.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  content: {
    minHeight: "100%",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 18
  },
  icon: {
    alignSelf: "center",
    width: 86,
    height: 86,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    // Note: React Native Web supports standard CSS properties like boxShadow as long as typescript/react-native types permit or through inline CSS.
    // To be safe for React Native (iOS/Android/Web), standard boxShadow object can be used or shadow props.
    // Let's use React Native's standard shadow styling or direct CSS web shadow if only running on web.
    // Expo/React Native standard shadow properties:
    shadowColor: "rgba(79, 111, 61, 0.22)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 5
  },
  iconText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 28
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center"
  },
  phoneHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 14
  },
  shareSymbol: {
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 24
  },
  phoneHintText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
    flexShrink: 1
  },
  steps: {
    gap: 12
  },
  step: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  stepNumberText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14
  },
  stepCopy: {
    flex: 1,
    gap: 3
  },
  stepTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  stepDetail: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18
  },
  warning: {
    color: colors.red,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  footer: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  }
});
