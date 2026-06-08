import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import React from "react";
import { ActivityIndicator, View } from "react-native";
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
import { colors } from "./src/theme/colors";

export default function App() {
  const [fontsLoaded] = useFonts({
    "WorkSans-Regular": require("./assets/fonts/WorkSans-Regular.ttf"),
    "WorkSans-Medium": require("./assets/fonts/WorkSans-Medium.ttf"),
    "WorkSans-Semibold": require("./assets/fonts/WorkSans-SemiBold.ttf"),
    "WorkSans-Bold": require("./assets/fonts/WorkSans-Bold.ttf")
  });

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
