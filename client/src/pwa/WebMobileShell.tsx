import React, { ReactNode, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

type WebMobileShellProps = {
  children: ReactNode;
};

// Global registry for route change callbacks
export const routeListeners = new Set<(route: string) => void>();

export function setGlobalRoute(route: string) {
  routeListeners.forEach((cb) => cb(route));
}

export function WebMobileShell({ children }: WebMobileShellProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const [currentRoute, setCurrentRoute] = useState("");

  useEffect(() => {
    const listener = (route: string) => {
      setCurrentRoute(route);
    };
    routeListeners.add(listener);
    return () => {
      routeListeners.add(listener);
    };
  }, []);

  // Determine if it is admin page by checking both current route state and window URL
  const isWebAdmin =
    currentRoute.toLowerCase().includes("admin") ||
    (typeof window !== "undefined" &&
      (window.location.href.toLowerCase().includes("admin") ||
        window.location.hash.toLowerCase().includes("admin") ||
        window.location.pathname.toLowerCase().includes("admin")));

  return (
    <View style={styles.webViewport}>
      <View style={[styles.mobileFrame, isWebAdmin && styles.adminFrame]}>{children}</View>
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
    maxWidth: 480,
    minHeight: "100%",
    alignSelf: "center",
    backgroundColor: colors.canvas,
    overflow: "hidden"
  },
  adminFrame: {
    maxWidth: "100%",
    alignSelf: "stretch"
  }
});