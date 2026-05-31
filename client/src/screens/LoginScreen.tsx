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
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { getGoogleIdToken } from "../services/googleSignIn";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { getAuthErrorMessage, validateLoginForm } from "./loginValidation";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { signIn, register, requestPhoneOtp, verifyPhoneOtp, signInWithFacebook, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneNeedsPassword, setPhoneNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { width: viewportWidth } = useWindowDimensions();
  const showDesktopFrame = Platform.OS === "web" && viewportWidth >= 520;

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
      Alert.alert("Không thể đăng nhập bằng Facebook", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const validation = validateLoginForm({
      authMethod,
      mode,
      identifier,
      password,
      otp,
      phoneOtpSent,
      phoneNeedsPassword
    });

    if (validation) {
      Alert.alert(validation.title, validation.message);
      return;
    }

    setLoading(true);
    try {
      if (authMethod === "phone") {
        if (!phoneOtpSent) {
          await requestPhoneCode();
          return;
        }
        await verifyPhoneOtp(identifier, otp, phoneNeedsPassword ? password : undefined, displayName);
      } else if (mode === "login") {
        await signIn(identifier, password);
      } else {
        await register(identifier, password, displayName);
      }
    } catch (error) {
      Alert.alert(mode === "login" ? "Không thể đăng nhập" : "Không thể tạo tài khoản", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function requestPhoneCode() {
    if (!identifier.trim()) {
      Alert.alert("Nhập số điện thoại", "Vui lòng nhập số điện thoại trước khi lấy mã OTP.");
      return;
    }
    const result = await requestPhoneOtp(identifier);
    setPhoneOtpSent(true);
    setPhoneNeedsPassword(result.requiresPasswordSetup);
    setOtp("");
    Alert.alert(
      "Đã gửi mã OTP",
      result.devOtp ? `Mã OTP dev: ${result.devOtp}` : "Vui lòng kiểm tra tin nhắn trên điện thoại."
    );
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      await signInWithGoogle(idToken);
    } catch (error) {
      Alert.alert("Không thể đăng nhập bằng Google", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneLoginPress() {
    if (authMethod !== "phone") {
      setAuthMethod("phone");
      setPhoneOtpSent(false);
      setPhoneNeedsPassword(false);
      setOtp("");
      setPassword("");
      return;
    }
    setLoading(true);
    try {
      await requestPhoneCode();
    } catch (error) {
      Alert.alert("Không thể gửi OTP", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function handleSocialPress(icon: "logo-facebook" | "logo-google" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
      return;
    }
    if (icon === "logo-google") {
      handleGoogleLogin();
      return;
    }
    handlePhoneLoginPress();
  }

  return (
    <View style={[styles.page, showDesktopFrame && styles.desktopPage]}>
      <ImageBackground
        source={require("../../assets/backgrounds/background1.png")}
        style={[styles.background, showDesktopFrame && styles.desktopFrame]}
        resizeMode="stretch"
      >
        <View pointerEvents="none" style={styles.foodCluster}>
          <Image
            source={require("../../assets/feed/home-food-back.png")}
            style={[styles.foodCard, styles.foodLeft]}
            resizeMode="cover"
          />
          <Image
            source={require("../../assets/feed/home-food-mid.png")}
            style={[styles.foodCard, styles.foodCenter]}
            resizeMode="cover"
          />
          <Image
            source={require("../../assets/feed/home-food-main.png")}
            style={[styles.foodCard, styles.foodRight]}
            resizeMode="cover"
          />
        </View>
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

              {mode === "register" || (authMethod === "phone" && phoneNeedsPassword) ? (
                <FigmaField
                  label="Tên hiển thị"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Nguyễn Văn A"
                  autoCapitalize="words"
                />
              ) : null}

              <FigmaField
                label={authMethod === "phone" ? "Số điện thoại" : mode === "login" ? "Tên đăng nhập" : "Email"}
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (authMethod === "phone") {
                    setPhoneOtpSent(false);
                    setPhoneNeedsPassword(false);
                    setOtp("");
                  }
                }}
                keyboardType={authMethod === "phone" ? "phone-pad" : "email-address"}
                autoCapitalize="none"
                placeholder={
                  authMethod === "phone"
                    ? "Nhập số điện thoại"
                    : mode === "login"
                      ? "Nhập tên đăng nhập"
                      : "email@example.com"
                }
              />

              {authMethod === "phone" && phoneOtpSent ? (
                <FigmaField
                  label="Mã OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Nhập mã OTP"
                />
              ) : null}

              {authMethod === "email" || (authMethod === "phone" && phoneOtpSent && phoneNeedsPassword) ? (
                <FigmaField
                  label={authMethod === "phone" ? "Tạo mật khẩu" : "Mật khẩu"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  placeholder={authMethod === "phone" ? "Tạo mật khẩu cho tài khoản mới" : "Nhập mật khẩu"}
                />
              ) : null}

              {authMethod === "phone" ? (
                <>
                  <AppButton
                    label={phoneOtpSent ? "Xác nhận OTP" : "Gửi OTP"}
                    onPress={submit}
                    loading={loading}
                    style={styles.primaryAction}
                  />
                  <Pressable
                    onPress={() => {
                      setAuthMethod("email");
                      setPhoneOtpSent(false);
                      setPhoneNeedsPassword(false);
                      setOtp("");
                    }}
                  >
                    <AppText style={styles.switchText}>Đăng nhập bằng email</AppText>
                  </Pressable>
                </>
              ) : mode === "login" ? (
                <>
                  <AppButton
                    label="Đăng nhập"
                    onPress={submit}
                    loading={loading}
                    style={styles.primaryAction}
                  />
                  <Pressable onPress={() => setMode("register")}>
                    <AppText style={styles.switchText}>
                      Chưa có tài khoản? <AppText style={styles.switchLink}>Đăng ký ngay</AppText>
                    </AppText>
                  </Pressable>
                </>
              ) : (
                <>
                  <AppButton
                    label="Tạo tài khoản"
                    onPress={submit}
                    loading={loading}
                    style={styles.primaryAction}
                  />

                  <Pressable onPress={() => setMode("login")}>
                    <AppText style={styles.switchText}>
                      Đã có tài khoản? <AppText style={styles.switchLink}>Đăng nhập</AppText>
                    </AppText>
                  </Pressable>
                </>
              )}

              <AppText style={styles.otherLoginText}>Phương thức đăng nhập khác</AppText>

              <View style={styles.socialRow}>
                {(["logo-facebook", "logo-google", "call-outline"] as const).map((icon) => (
                  <Pressable
                    key={icon}
                    style={styles.socialButton}
                    onPress={() => handleSocialPress(icon)}
                    disabled={loading || (icon === "logo-facebook" && !request)}
                  >
                    <Ionicons name={icon} size={23} color={colors.white} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
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
  page: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  desktopPage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  background: {
    flex: 1,
    width: "100%",
    overflow: "hidden"
  },
  desktopFrame: {
    maxWidth: 390,
    maxHeight: 844,
    alignSelf: "center",
    borderRadius: 28
  },
  safeArea: {
    flex: 1,
    zIndex: 1
  },
  flex1: {
    flex: 1
  },
  formContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 236
  },
  foodCluster: {
    position: "absolute",
    left: -44,
    right: -44,
    bottom: -18,
    height: 198,
    zIndex: 0
  },
  foodCard: {
    position: "absolute",
    width: 206,
    height: 166,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4
  },
  foodLeft: {
    left: -2,
    bottom: -4,
    opacity: 0.9,
    transform: [{ rotate: "-14deg" }]
  },
  foodCenter: {
    left: "29%",
    bottom: 8,
    opacity: 0.46,
    transform: [{ rotate: "2deg" }]
  },
  foodRight: {
    right: -2,
    bottom: -3,
    opacity: 0.92,
    transform: [{ rotate: "13deg" }]
  },
  logoBadge: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
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
    width: 42,
    height: 42,
    borderRadius: 21
  },
  heading: {
    gap: 4,
    marginTop: 42,
    marginBottom: 16
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
