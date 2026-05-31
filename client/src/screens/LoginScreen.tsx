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
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { getGoogleIdToken } from "../services/googleSignIn";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const {
    signIn,
    register,
    signInWithFacebook,
    signInWithGoogle,
    requestPhoneOtp,
    verifyPhoneOtp
  } = useAuth();
  
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
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

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      await signInWithGoogle(idToken);
    } catch (error) {
      // Don't show alert if cancelled by user
      if (error instanceof Error && error.message.includes("cancelled")) {
        return;
      }
      Alert.alert("Không thể đăng nhập bằng Google", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!phone.trim()) {
      Alert.alert("Thiếu số điện thoại", "Vui lòng nhập số điện thoại của bạn.");
      return;
    }
    setLoading(true);
    try {
      const result = await requestPhoneOtp(phone);
      setRequiresPasswordSetup(result.requiresPasswordSetup);
      setOtpSent(true);
      if (result.devOtp) {
        Alert.alert("Mã OTP (Thử nghiệm)", `Mã OTP của bạn là: ${result.devOtp}`);
      } else {
        Alert.alert("Đã gửi OTP", "Vui lòng kiểm tra tin nhắn SMS để nhận mã xác thực.");
      }
    } catch (error) {
      Alert.alert("Lỗi gửi OTP", error instanceof Error ? error.message : "Không thể gửi OTP lúc này.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      Alert.alert("Thiếu mã OTP", "Vui lòng nhập mã OTP đã nhận.");
      return;
    }
    if (requiresPasswordSetup && (!password.trim() || !displayName.trim())) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập Tên hiển thị và Mật khẩu cho tài khoản mới.");
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, otp, requiresPasswordSetup ? password : undefined, requiresPasswordSetup ? displayName : undefined);
    } catch (error) {
      Alert.alert("Mã OTP không đúng", error instanceof Error ? error.message : "Thử lại sau");
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

  function handleSocialPress(icon: "logo-facebook" | "logo-google" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
    } else if (icon === "logo-google") {
      handleGoogleLogin();
    } else if (icon === "call-outline") {
      setAuthMethod("phone");
      setOtpSent(false);
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
            <View style={styles.formCard}>
              {/* Heading */}
              <View style={styles.heading}>
                <AppText variant="title">
                  {authMethod === "phone" 
                    ? "Đăng nhập SĐT" 
                    : mode === "login" 
                      ? "Đăng nhập" 
                      : "Tạo tài khoản"}
                </AppText>
                <AppText muted>
                  {authMethod === "phone"
                    ? "Nhập số điện thoại để nhận mã OTP."
                    : mode === "login"
                      ? "Chọn phương thức đăng nhập"
                      : "Bắt đầu hành trình ẩm thực của bạn."}
                </AppText>
              </View>

              {/* Form Content depending on Auth Method */}
              {authMethod === "phone" ? (
                // --- PHONE OTP FLOW ---
                <View style={styles.phoneForm}>
                  {!otpSent ? (
                    // Step 1: Input Phone
                    <View style={styles.gap12}>
                      <TextField
                        label="Số điện thoại"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="09XXXXXXXX"
                      />
                      <AppButton
                        label="Gửi mã OTP"
                        onPress={handleSendOtp}
                        loading={loading}
                      />
                    </View>
                  ) : (
                    // Step 2: Input OTP + Info if needed
                    <View style={styles.gap12}>
                      <TextField
                        label="Mã OTP"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        placeholder="Nhập 6 số OTP"
                      />
                      
                      {requiresPasswordSetup && (
                        <View style={styles.gap12}>
                          <AppText variant="caption" style={styles.setupWarning}>
                            Đây là số điện thoại mới, vui lòng thiết lập hồ sơ:
                          </AppText>
                          <TextField
                            label="Tên hiển thị"
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Nguyễn Văn A"
                            autoCapitalize="words"
                          />
                          <TextField
                            label="Thiết lập Mật khẩu"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholder="Nhập mật khẩu mới"
                          />
                        </View>
                      )}

                      <AppButton
                        label="Xác thực & Vào ứng dụng"
                        onPress={handleVerifyOtp}
                        loading={loading}
                      />

                      <Pressable onPress={handleSendOtp} disabled={loading}>
                        <AppText style={styles.resendLink}>
                          Không nhận được mã? Gửi lại OTP
                        </AppText>
                      </Pressable>
                    </View>
                  )}

                  <Pressable onPress={() => { setAuthMethod("email"); setOtpSent(false); }} style={styles.switchMethodBtn}>
                    <AppText style={styles.switchLink}>
                      Sử dụng đăng nhập bằng Email
                    </AppText>
                  </Pressable>
                </View>
              ) : (
                // --- EMAIL / PASSWORD FLOW ---
                <View style={styles.gap12}>
                  {/* Section header */}
                  {mode === "login" ? (
                    <AppText variant="label" style={styles.sectionHeader}>
                      Đăng nhập vào tk hiện có
                    </AppText>
                  ) : null}

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
                </View>
              )}

              {/* Divider label */}
              <AppText variant="caption" muted style={styles.dividerText}>
                Phương thức đăng nhập khác
              </AppText>

              {/* Social */}
              <View style={styles.socialRow}>
                {([
                  { icon: "logo-facebook", enabled: !!request },
                  { icon: "logo-google", enabled: true },
                  { icon: "call-outline", enabled: authMethod !== "phone" }
                ] as const).map(({ icon, enabled }) => (
                  <Pressable
                    key={icon}
                    style={[styles.socialButton, !enabled && styles.socialButtonDisabled]}
                    onPress={() => enabled && handleSocialPress(icon)}
                    disabled={!enabled}
                  >
                    <Ionicons name={icon} size={22} color={colors.white} />
                  </Pressable>
                ))}
              </View>
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
    flexGrow: 1,
    justifyContent: "center"
  },
  formCard: {
    gap: 16
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
  },
  socialButtonDisabled: {
    backgroundColor: colors.canvasStrong,
    opacity: 0.6
  },
  phoneForm: {
    gap: 16
  },
  gap12: {
    gap: 12
  },
  setupWarning: {
    color: colors.greenDark,
    fontFamily: fonts.medium,
    marginTop: 4
  },
  resendLink: {
    textAlign: "center",
    color: colors.muted,
    textDecorationLine: "underline",
    fontSize: 13,
    marginTop: 4
  },
  switchMethodBtn: {
    alignItems: "center",
    marginTop: 8
  },
  dividerText: {
    marginTop: 12
  }
});
