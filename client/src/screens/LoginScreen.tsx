import React, { useState } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as WebBrowser from "expo-web-browser";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { getGoogleIdToken } from "../services/googleSignIn";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { signIn, signInWithPhone, register, registerWithPhone, signInWithFacebook, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "3483710358450589",
    scopes: ["public_profile"]
  });

  React.useEffect(() => {
    if (response?.type === "success" && response.authentication) {
      const { accessToken } = response.authentication;
      handleFacebookLogin(accessToken);
    }
  }, [response]);

  async function handleFacebookLogin(accessToken: string) {
    setLoading(true);
    try {
      await signInWithFacebook(accessToken);
    } catch (error) {
      Alert.alert("Không thể đăng nhập bằng Facebook", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      await signInWithGoogle(idToken);
    } catch (error) {
      Alert.alert("Không thể đăng nhập bằng Google", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    try {
      if (mode === "login") {
        if (authMethod === "phone") {
          await signInWithPhone(phone, password);
        } else {
          await signIn(email, password);
        }
      } else if (authMethod === "phone") {
        await registerWithPhone(phone, password, displayName);
      } else {
        await register(email, password, displayName);
      }
    } catch (error) {
      Alert.alert("Không thể đăng nhập", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialPress(icon: "logo-facebook" | "logo-google" | "mail-outline" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
    } else if (icon === "logo-google") {
      handleGoogleLogin();
    } else if (icon === "mail-outline") {
      setAuthMethod("email");
    } else if (icon === "call-outline") {
      setAuthMethod("phone");
    } else {
      setAuthMethod("email");
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={styles.flex1}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading */}
            <View style={styles.heading}>
              <AppText variant="title">
                {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              </AppText>
              <AppText muted>
                {mode === "login"
                  ? "Chọn phương thức đăng nhập"
                  : "Bắt đầu hành trình ẩm thực của bạn."}
              </AppText>
            </View>

            {/* Section header */}
            {mode === "login" ? (
              <AppText variant="label" style={styles.sectionHeader}>
                Đăng nhập vào tk hiện có
              </AppText>
            ) : null}

            {/* Form */}
            <View style={styles.methodTabs}>
              <Pressable
                accessibilityRole="button"
                style={[styles.methodTab, authMethod === "email" && styles.methodTabActive]}
                onPress={() => setAuthMethod("email")}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={authMethod === "email" ? colors.white : colors.green}
                />
                <AppText style={[styles.methodText, authMethod === "email" && styles.methodTextActive]}>
                  Email
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.methodTab, authMethod === "phone" && styles.methodTabActive]}
                onPress={() => setAuthMethod("phone")}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={authMethod === "phone" ? colors.white : colors.green}
                />
                <AppText style={[styles.methodText, authMethod === "phone" && styles.methodTextActive]}>
                  Số điện thoại
                </AppText>
              </Pressable>
            </View>

            {mode === "register" ? (
              <TextField
                label="Tên hiển thị"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                autoCapitalize="words"
              />
            ) : null}
            {authMethod === "phone" ? (
              <TextField
                label="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="0901234567 hoặc +84901234567"
              />
            ) : (
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="email@example.com"
              />
            )}
            <TextField
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Nhập mật khẩu"
            />

            <AppButton
              label={mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              onPress={submit}
              loading={loading}
            />

            <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <AppText style={styles.switchText}>
                {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <AppText style={styles.switchLink}>
                  {mode === "login" ? "Tạo tài khoản" : "Đăng nhập"}
                </AppText>
              </AppText>
            </Pressable>

            {/* Divider label */}
            <AppText variant="caption" muted>
              Phương thức đăng nhập khác
            </AppText>

            {/* Social */}
            <View style={styles.socialRow}>
              {(["logo-facebook", "logo-google", "mail-outline", "call-outline"] as const).map((icon) => (
                <Pressable
                  key={icon}
                  style={styles.socialButton}
                  onPress={() => handleSocialPress(icon)}
                  disabled={icon === "logo-facebook" && !request}
                >
                  <Ionicons name={icon} size={22} color={colors.white} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  flex1: {
    flex: 1
  },
  formContent: {
    padding: 20,
    gap: 16
  },
  heading: {
    gap: 4
  },
  sectionHeader: {
    marginTop: 4
  },
  methodTabs: {
    flexDirection: "row",
    gap: 10
  },
  methodTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  methodTabActive: {
    backgroundColor: colors.green
  },
  methodText: {
    color: colors.green,
    fontFamily: fonts.semibold
  },
  methodTextActive: {
    color: colors.white
  },
  switchText: {
    textAlign: "center",
    color: colors.muted
  },
  switchLink: {
    color: colors.green,
    fontFamily: fonts.semibold
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 16
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  }
});
