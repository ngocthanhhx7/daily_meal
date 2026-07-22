import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { analytics } from "../services/analytics";
import { colors } from "../theme/colors";
import { setGlobalRoute } from "../pwa/WebMobileShell";

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
import { MealRecommendationScreen } from "../screens/MealRecommendationScreen";
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
import { ProgressScreen } from "../screens/ProgressScreen";
import { PostSummaryScreen } from "../screens/PostSummaryScreen";
import { AdminDashboardScreen, AdminLoginScreen, AdminUserDetailScreen, AdminUsersScreen } from "../screens/AdminScreens";

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
  const { isLoading, token, user, isAdmin } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    analytics.setAuthToken(token);
  }, [token]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const routeName = navigationRef.current?.getCurrentRoute()?.name;
        routeNameRef.current = routeName;
        if (routeName) {
          setGlobalRoute(routeName);
        }
        analytics.setCurrentScreen(routeName);
        if (routeName) {
          analytics.track("screen_view", { screen: routeName });
        }
      }}
      onStateChange={() => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

        if (currentRouteName) {
          setGlobalRoute(currentRouteName);
        }

        if (currentRouteName && previousRouteName !== currentRouteName) {
          analytics.setCurrentScreen(currentRouteName);
          analytics.track("screen_view", {
            screen: currentRouteName,
            referrer: previousRouteName
          });
        }

        routeNameRef.current = currentRouteName;
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Smooth slide animation
          animation: "slide_from_right"
        }}
      >
        {/* ── AUTH FLOW ── */}
        {isAdmin ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ animation: "none" }} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
          </>
        ) : !user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          </>
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
            <Stack.Screen name="MealRecommendation" component={MealRecommendationScreen} />
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
            <Stack.Screen name="PostSummary" component={PostSummaryScreen} />
            <Stack.Screen name="Blocked" component={BlockedScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="ShareAccount" component={ShareAccountScreen} />
            <Stack.Screen name="PremiumBenefits" component={PremiumBenefitsScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
