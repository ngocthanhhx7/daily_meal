import React from "react";
import {
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
  /** Set true to skip the Figma line background (e.g. login/onboarding manage their own) */
  noBackground?: boolean;
  scrollProps?: Omit<ScrollViewProps, "showsVerticalScrollIndicator">;
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
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
      contentContainerStyle={[styles.content, style, scrollProps?.contentContainerStyle]}
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

  return <FigmaLineBackground>{inner}</FigmaLineBackground>;
}

export function FigmaLineBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.background}>
      <View pointerEvents="none" style={styles.linePattern}>
        {Array.from({ length: 72 }).map((_, index) => (
          <View key={index} style={styles.patternLine} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    overflow: "hidden"
  },
  linePattern: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    left: -20,
    width: "116%"
  },
  patternLine: {
    height: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)"
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
