import React, { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

type WebMobileShellProps = {
  children: ReactNode;
};

export function WebMobileShell({ children }: WebMobileShellProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={styles.webViewport}>
      <View style={styles.mobileFrame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  webViewport: {
    flex: 1,
    width: "100%",
    minHeight: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.canvas
  },
  mobileFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    minHeight: "100%",
    alignSelf: "center",
    backgroundColor: colors.canvas,
    overflow: "hidden"
  }
});