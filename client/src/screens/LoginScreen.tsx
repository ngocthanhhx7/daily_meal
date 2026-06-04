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
import { IOS_MINIMUM_INPUT_FONT_SIZE, getKeyboardAvoidingBehavior } from "../utils/keyboardAvoidance";
import {
  createAuthErrorState,
  getAuthErrorMessage,
  validateForgotPasswordForm,
  validateLoginForm,
  type LoginValidationError
} from "./loginValidation";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const {
    signIn,
    register,
    requestPhoneOtp,
    verifyPhoneOtp,
    requestPasswordResetOtp,
    verifyPasswordResetOtp,
    signInWithFacebook,
    signInWithGoogle
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [passwordResetMode, setPasswordResetMode] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneNeedsPassword, setPhoneNeedsPassword] = useState(false);
  const [passwordResetOtpSent, setPasswordResetOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<LoginValidationError | null>(null);
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
      setAuthError({
        title: "Không thể đăng nhập bằng Facebook",
        message: getAuthErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  }

  function clearAuthError() {
    if (authError) {
      setAuthError(null);
    }
  }

  async function submit() {
    if (passwordResetMode) {
      await submitPasswordReset();
      return;
    }

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
      setAuthError(validation);
      return;
    }

    setAuthError(null);
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
      setAuthError(createAuthErrorState(mode, error));
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordReset() {
    const validation = validateForgotPasswordForm({
      email: identifier,
      otp,
      otpSent: passwordResetOtpSent,
      newPassword: passwordResetOtpSent ? password : undefined
    });

    if (validation) {
      setAuthError(validation);
      return;
    }

    setAuthError(null);
    setLoading(true);
    try {
      if (!passwordResetOtpSent) {
        const result = await requestPasswordResetOtp(identifier);
        setPasswordResetOtpSent(true);
        setOtp("");
        setPassword("");
        Alert.alert(
          "Đã gửi OTP",
          result.devOtp ? `Mã OTP dev: ${result.devOtp}` : "Vui lòng kiểm tra Gmail của bạn."
        );
        return;
      }

      await verifyPasswordResetOtp(identifier, otp, password);
      Alert.alert(
        "Thành công",
        "Mật khẩu của bạn đã được thay đổi và bạn đã đăng nhập thành công."
      );
      setPasswordResetMode(false);
      setPasswordResetOtpSent(false);
      setOtp("");
      setPassword("");
    } catch (error) {
      setAuthError({
        title: passwordResetOtpSent ? "Không thể xác nhận OTP" : "Không thể gửi OTP",
        message: getAuthErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  }

  async function requestPhoneCode() {
    if (!identifier.trim()) {
      setAuthError({
        title: "Nhập số điện thoại",
        message: "Vui lòng nhập số điện thoại trước khi lấy mã OTP."
      });
      return;
    }
    setAuthError(null);
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
      setAuthError({
        title: "Không thể đăng nhập bằng Google",
        message: getAuthErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneLoginPress() {
    if (authMethod !== "phone") {
      setAuthMethod("phone");
      setAuthError(null);
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
      setAuthError({
        title: "Không thể gửi OTP",
        message: getAuthErrorMessage(error)
      });
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
            behavior={getKeyboardAvoidingBehavior(Platform.OS)}
            contentContainerStyle={styles.flex1}
            style={styles.flex1}
          >
            <ScrollView
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <View style={styles.heading}>
                <AppText style={styles.titleText}>
                  {passwordResetMode ? "Quên mật khẩu" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                </AppText>
                <AppText style={styles.subtitleText}>
                  {passwordResetMode
                    ? "Xác thực email để nhận mật khẩu mới."
                    : mode === "login"
                      ? "Chọn phương thức đăng nhập"
                      : "Bắt đầu hành trình ẩm thực của bạn."}
                </AppText>
              </View>

              {authError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color={colors.red} />
                  <View style={styles.errorCopy}>
                    <AppText style={styles.errorTitle}>{authError.title}</AppText>
                    <AppText style={styles.errorMessage}>{authError.message}</AppText>
                  </View>
                </View>
              ) : null}

              {passwordResetMode ? (
                <AppText style={styles.sectionHeader}>Nhập email tài khoản của bạn</AppText>
              ) : mode === "login" ? (
                <AppText style={styles.sectionHeader}>Đăng nhập vào tk hiện có</AppText>
              ) : null}

              {!passwordResetMode && (mode === "register" || (authMethod === "phone" && phoneNeedsPassword)) ? (
                <FigmaField
                  label="Tên hiển thị"
                  value={displayName}
                  onChangeText={(value) => {
                    setDisplayName(value);
                    clearAuthError();
                  }}
                  placeholder="Nguyễn Văn A"
                  autoCapitalize="words"
                />
              ) : null}

              <FigmaField
                label={passwordResetMode ? "Email" : authMethod === "phone" ? "Số điện thoại" : mode === "login" ? "Tên đăng nhập" : "Email"}
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  clearAuthError();
                  if (passwordResetMode) {
                    setPasswordResetOtpSent(false);
                    setOtp("");
                  }
                  if (authMethod === "phone") {
                    setPhoneOtpSent(false);
                    setPhoneNeedsPassword(false);
                    setOtp("");
                  }
                }}
                keyboardType={authMethod === "phone" && !passwordResetMode ? "phone-pad" : "email-address"}
                autoCapitalize="none"
                placeholder={
                  passwordResetMode
                    ? "email@example.com"
                    : authMethod === "phone"
                    ? "Nhập số điện thoại"
                    : mode === "login"
                      ? "Nhập tên đăng nhập"
                      : "email@example.com"
                }
              />

              {(passwordResetMode && passwordResetOtpSent) || (authMethod === "phone" && phoneOtpSent) ? (
                <FigmaField
                  label="Mã OTP"
                  value={otp}
                  onChangeText={(value) => {
                    setOtp(value);
                    clearAuthError();
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Nhập mã OTP"
                />
              ) : null}

              {passwordResetMode && passwordResetOtpSent ? (
                <FigmaField
                  label="Mật khẩu mới"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearAuthError();
                  }}
                  secureTextEntry
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                />
              ) : null}

              {!passwordResetMode && (authMethod === "email" || (authMethod === "phone" && phoneOtpSent && phoneNeedsPassword)) ? (
                <FigmaField
                  label={authMethod === "phone" ? "Tạo mật khẩu" : "Mật khẩu"}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearAuthError();
                  }}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  placeholder={authMethod === "phone" ? "Tạo mật khẩu cho tài khoản mới" : "Nhập mật khẩu"}
                />
              ) : null}

              {passwordResetMode ? (
                <>
                  <AppButton
                    label={passwordResetOtpSent ? "Xác nhận OTP" : "Gửi OTP"}
                    onPress={submit}
                    loading={loading}
                    style={styles.primaryAction}
                  />
                  <Pressable
                    onPress={() => {
                      setPasswordResetMode(false);
                      setPasswordResetOtpSent(false);
                      setOtp("");
                      setAuthError(null);
                    }}
                  >
                    <AppText style={styles.switchText}>Quay lại đăng nhập</AppText>
                  </Pressable>
                </>
              ) : authMethod === "phone" ? (
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
                      setAuthError(null);
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
                  <Pressable
                    onPress={() => {
                      setMode("register");
                      setPasswordResetMode(false);
                      setAuthError(null);
                    }}
                  >
                    <AppText style={styles.switchText}>
                      Chưa có tài khoản? <AppText style={styles.switchLink}>Đăng ký ngay</AppText>
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPasswordResetMode(true);
                      setAuthMethod("email");
                      setMode("login");
                      setPassword("");
                      setOtp("");
                      setPasswordResetOtpSent(false);
                      setAuthError(null);
                    }}
                  >
                    <AppText style={[styles.switchText, styles.forgotText]}>Quên mật khẩu?</AppText>
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

                  <Pressable
                    onPress={() => {
                      setMode("login");
                      setPasswordResetMode(false);
                      setAuthError(null);
                    }}
                  >
                    <AppText style={styles.switchText}>
                      Đã có tài khoản? <AppText style={styles.switchLink}>Đăng nhập</AppText>
                    </AppText>
                  </Pressable>
                </>
              )}

              {!passwordResetMode ? (
                <>
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
                </>
              ) : null}
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.red}55`,
    backgroundColor: `${colors.red}12`
  },
  errorCopy: {
    flex: 1,
    gap: 2
  },
  errorTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.red
  },
  errorMessage: {
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
    fontSize: IOS_MINIMUM_INPUT_FONT_SIZE,
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
  forgotText: {
    marginTop: 8,
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
