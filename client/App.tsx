import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { IosInstallGate } from "./src/pwa/IosInstallGate";
import { PwaRuntime } from "./src/pwa/PwaRuntime";
import { WebMobileShell } from "./src/pwa/WebMobileShell";
import { shouldShowIosInstallGate } from "./src/pwa/platform";
import { analytics, setupAnalyticsRuntime } from "./src/services/analytics";
import { colors } from "./src/theme/colors";

export default function App() {
  const sessionEndedRef = useRef(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadFonts() {
      if (typeof Font.loadAsync !== "function") {
        console.warn("Font.loadAsync is unavailable; continuing with system fonts.");
        if (mounted) {
          setFontsLoaded(true);
        }
        return;
      }

      try {
        await Font.loadAsync({
          "WorkSans-Regular": require("./assets/fonts/WorkSans-Regular.ttf"),
          "WorkSans-Medium": require("./assets/fonts/WorkSans-Medium.ttf"),
          "WorkSans-Semibold": require("./assets/fonts/WorkSans-SemiBold.ttf"),
          "WorkSans-Bold": require("./assets/fonts/WorkSans-Bold.ttf")
        });
      } catch (error) {
        console.warn("Failed to load custom fonts; continuing with system fonts.", error);
      } finally {
        if (mounted) {
          setFontsLoaded(true);
        }
      }
    }

    loadFonts();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const cleanupRuntime = setupAnalyticsRuntime();

    analytics.startSession();
    sessionEndedRef.current = false;

    const endSession = (reason: string) => {
      if (sessionEndedRef.current) {
        return;
      }

      sessionEndedRef.current = true;
      analytics.endSession(reason);
    };

    const resumeSession = () => {
      if (!sessionEndedRef.current) {
        return;
      }

      analytics.startSession({ resumed: true });
      sessionEndedRef.current = false;
    };

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        resumeSession();
      } else if (state === "background" || state === "inactive") {
        endSession(state);
      }
    });

    const handleVisibilityChange = () => {
      if (Platform.OS !== "web" || typeof document === "undefined") {
        return;
      }

      if (document.visibilityState === "visible") {
        resumeSession();
      } else {
        endSession("hidden");
      }
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      endSession("unmount");
      cleanupRuntime();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <WebMobileShell>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
          <PwaRuntime />
          <ActivityIndicator color={colors.green} />
        </View>
      </WebMobileShell>
    );
  }

  if (shouldShowIosInstallGate()) {
    return (
      <WebMobileShell>
        <SafeAreaProvider>
          <PwaRuntime />
          <StatusBar style="dark" />
          <IosInstallGate />
        </SafeAreaProvider>
      </WebMobileShell>
    );
  }

  return (
    <WebMobileShell>
      <SafeAreaProvider>
        <PwaRuntime />
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <AppNavigator />
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </WebMobileShell>
  );
}
