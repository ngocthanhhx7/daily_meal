import React from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
  type ScrollViewProps
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

type AppScreenProps = ViewProps & {
  scroll?: boolean;
  keyboard?: boolean;
  /** Set true to skip the background image (e.g. login/onboarding manage their own) */
  noBackground?: boolean;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "showsVerticalScrollIndicator">;
};

export function AppScreen({
  children,
  scroll = true,
  keyboard = false,
  noBackground = false,
  style,
  scrollProps
}: AppScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, style]}>{children}</View>
  );

  const inner = (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        enabled={keyboard}
        style={styles.fill}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (noBackground) {
    return inner;
  }

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background2.png")}
      style={styles.background}
      resizeMode="cover"
    >
      {inner}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  fill: {
    flex: 1
  },
  content: {
    padding: 20,
    gap: 16,
    // Đảm bảo content luôn stretch hết chiều cao khi scroll=false
    flexGrow: 1
  }
});
