import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
