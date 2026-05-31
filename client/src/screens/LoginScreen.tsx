import React, { useState } from "react";
import {
  Alert,
  Image,
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
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { signIn, register, signInWithFacebook } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sử dụng AuthSession tổng quát để kiểm soát tuyệt đối các tham số gửi sang Facebook
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "3483710358450589",
      scopes: ["public_profile"],
      redirectUri: AuthSession.makeRedirectUri(),
      responseType: AuthSession.ResponseType.Token,
    },
    {
      authorizationEndpoint: "https://www.facebook.com/v6.0/dialog/oauth",
      tokenEndpoint: "https://graph.facebook.com/v6.0/oauth/access_token",
    }
  );

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

  async function submit() {
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await register(email, password, displayName);
      }
    } catch (error) {
      Alert.alert("Không thể đăng nhập", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function placeholder() {
    Alert.alert("Chưa hỗ trợ", "Phiên bản đầu chỉ hỗ trợ email, mật khẩu và Facebook.");
  }

  function handleSocialPress(icon: "logo-facebook" | "mail-outline" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
    } else {
      placeholder();
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background1.png")}
      style={styles.background}
      resizeMode="stretch"
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
            {/* Logo khủng long dễ thương ở trên cùng chuẩn Figma */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/logo/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

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
            {mode === "register" ? (
              <TextField
                label="Tên hiển thị"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                autoCapitalize="words"
              />
            ) : null}
            <TextField
              label={mode === "login" ? "Tên đăng nhập" : "Email"}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={mode === "login" ? "Nhập tên đăng nhập" : "email@example.com"}
            />
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
              {(["logo-facebook", "mail-outline", "call-outline"] as const).map((icon) => (
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
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32
  },
  heading: {
    gap: 4
  },
  sectionHeader: {
    marginTop: 4
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
