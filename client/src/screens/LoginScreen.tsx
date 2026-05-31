import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
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
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
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

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "3483710358450589",
      scopes: ["public_profile"],
      redirectUri: AuthSession.makeRedirectUri(),
      responseType: AuthSession.ResponseType.Token
    },
    {
      authorizationEndpoint: "https://www.facebook.com/v6.0/dialog/oauth",
      tokenEndpoint: "https://graph.facebook.com/v6.0/oauth/access_token"
    }
  );

  React.useEffect(() => {
    if (response?.type === "success" && response.authentication) {
      handleFacebookLogin(response.authentication.accessToken);
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
      Alert.alert(mode === "login" ? "Không thể đăng nhập" : "Không thể tạo tài khoản", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function placeholder() {
    Alert.alert("Chưa hỗ trợ", "Phiên bản này đang ưu tiên email, mật khẩu và Facebook.");
  }

  function handleSocialPress(icon: "logo-facebook" | "mail-outline" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
      return;
    }
    placeholder();
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
            <View style={styles.logoBadge}>
              <Image source={require("../../assets/logo/logo.png")} style={styles.logo} resizeMode="cover" />
            </View>

            <View style={styles.heading}>
              <AppText style={styles.titleText}>
                {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              </AppText>
              <AppText style={styles.subtitleText}>
                {mode === "login" ? "Chọn phương thức đăng nhập" : "Bắt đầu hành trình ẩm thực của bạn."}
              </AppText>
            </View>

            {mode === "login" ? (
              <AppText style={styles.sectionHeader}>Đăng nhập vào tk hiện có</AppText>
            ) : null}

            {mode === "register" ? (
              <FigmaField
                label="Tên hiển thị"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                autoCapitalize="words"
              />
            ) : null}

            <FigmaField
              label={mode === "login" ? "Tên đăng nhập" : "Email"}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={mode === "login" ? "Nhập tên đăng nhập" : "email@example.com"}
            />
            <FigmaField
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
              style={styles.primaryAction}
            />

            <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <AppText style={styles.switchText}>
                {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <AppText style={styles.switchLink}>
                  {mode === "login" ? "Tạo tài khoản" : "Đăng nhập"}
                </AppText>
              </AppText>
            </Pressable>

            <AppText style={styles.otherLoginText}>Phương thức đăng nhập khác</AppText>

            <View style={styles.socialRow}>
              {(["logo-facebook", "mail-outline", "call-outline"] as const).map((icon) => (
                <Pressable
                  key={icon}
                  style={styles.socialButton}
                  onPress={() => handleSocialPress(icon)}
                  disabled={icon === "logo-facebook" && !request}
                >
                  <Ionicons name={icon} size={23} color={colors.white} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

type FigmaFieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function FigmaField({ label, style, ...props }: FigmaFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        placeholderTextColor="rgba(0, 0, 0, 0.36)"
        {...props}
        style={[styles.figmaInput, style]}
      />
    </View>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 260
  },
  logoBadge: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 23
  },
  heading: {
    gap: 4,
    marginTop: 48,
    marginBottom: 22
  },
  titleText: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    color: colors.black,
    letterSpacing: 0
  },
  subtitleText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink
  },
  sectionHeader: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.black,
    marginBottom: 8
  },
  fieldWrap: {
    gap: 8,
    marginBottom: 14
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 15,
    color: "rgba(68, 68, 68, 0.62)"
  },
  figmaInput: {
    height: 44,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 15,
    elevation: 5
  },
  primaryAction: {
    minHeight: 48,
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 14
  },
  switchText: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  switchLink: {
    color: colors.green,
    fontFamily: fonts.semibold
  },
  otherLoginText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.black,
    marginTop: 24,
    marginBottom: 12
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3
  }
});
