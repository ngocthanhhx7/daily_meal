import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

// Screens
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { CommentsScreen } from "../screens/CommentsScreen";
import { CreatePostScreen } from "../screens/CreatePostScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { EditPostScreen } from "../screens/EditPostScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { InboxScreen } from "../screens/InboxScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { PublicProfileScreen } from "../screens/PublicProfileScreen";
import { RecipeScreen } from "../screens/RecipeScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SavedScreen } from "../screens/SavedScreen";
import { BlockedScreen } from "../screens/BlockedScreen";
import { SupportScreen } from "../screens/SupportScreen";
import { ShareAccountScreen } from "../screens/ShareAccountScreen";
import { PremiumBenefitsScreen } from "../screens/PremiumBenefitsScreen";
import { FollowsScreen } from "../screens/FollowsScreen";

// NOTE: MealsScreen removed – calo analysis is now in CreatePostScreen

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        backgroundColor: colors.canvas
      }}
    >
      <ActivityIndicator color={colors.green} size="large" />
      <AppText muted>Đang tải Daily Meal...</AppText>
    </View>
  );
}

export function AppNavigator() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Smooth slide animation
          animation: "slide_from_right"
        }}
      >
        {/* ── AUTH FLOW ── */}
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !user.preferences.completedOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // ── MAIN APP ──
          <>
            {/* Root – Locket-style feed with its own bottom bar */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ animation: "none" }}
            />

            {/* Secondary screens — slide in from right */}
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Create" component={CreatePostScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            <Stack.Screen name="Follows" component={FollowsScreen} />
            <Stack.Screen name="Inbox" component={InboxScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />

            {/* Modal-style screens — slide from bottom */}
            <Stack.Screen
              name="Comments"
              component={CommentsScreen}
              options={{ animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="Recipe"
              component={RecipeScreen}
              options={{ animation: "slide_from_bottom" }}
            />

            {/* Edit screens */}
            <Stack.Screen name="EditPost" component={EditPostScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Saved" component={SavedScreen} />
            <Stack.Screen name="Blocked" component={BlockedScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="ShareAccount" component={ShareAccountScreen} />
            <Stack.Screen name="PremiumBenefits" component={PremiumBenefitsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
