import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { FigmaLineBackground } from "../components/AppScreen";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const {
    signIn,
    signInWithPhone,
    register,
    registerWithPhone,
    requestPhoneOtp,
    verifyPhoneOtp,
    signInWithFacebook
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "phoneOtp">("login");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
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

  async function submit() {
    setLoading(true);
    try {
      if (mode === "phoneOtp") {
        await verifyPhoneOtp(
          phone,
          otp,
          requiresPasswordSetup ? password : undefined,
          displayName || undefined
        );
      } else if (mode === "login") {
        if (authMethod === "phone") {
          await signInWithPhone(phone, password);
        } else {
          await signIn(email, password);
        }
      } else {
        if (authMethod === "phone") {
          await registerWithPhone(phone, password, displayName);
        } else {
          await register(email, password, displayName);
        }
      }
    } catch (error) {
      Alert.alert("Không thể đăng nhập", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function startPhoneOtp() {
    if (!phone.trim()) {
      Alert.alert("Thiếu số điện thoại", "Vui lòng nhập số điện thoại trước khi lấy mã OTP.");
      return;
    }
    setLoading(true);
    try {
      const result = await requestPhoneOtp(phone);
      setRequiresPasswordSetup(result.requiresPasswordSetup);
      setMode("phoneOtp");
      Alert.alert(
        "Đã gửi mã OTP",
        result.devOtp ? `Mã OTP môi trường dev: ${result.devOtp}` : "Vui lòng kiểm tra tin nhắn SMS."
      );
    } catch (error) {
      Alert.alert("Không thể gửi OTP", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialPress(icon: "logo-facebook" | "mail-outline" | "call-outline") {
    if (icon === "logo-facebook") {
      promptAsync();
    } else if (icon === "call-outline") {
      setAuthMethod("phone");
    } else {
      setAuthMethod("email");
    }
  }

  function toggleMode() {
    setMode(mode === "register" ? "login" : "register");
    setOtp("");
    setRequiresPasswordSetup(false);
  }

  const isPhone = authMethod === "phone";
  const isOtpMode = mode === "phoneOtp";

  return (
    <FigmaLineBackground>
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
            <View style={styles.foodCluster} pointerEvents="none">
              <View style={[styles.foodImage, styles.foodLeft]} />
              <View style={[styles.foodImage, styles.foodCenter]} />
              <View style={[styles.foodImage, styles.foodRight]} />
            </View>

            <View style={styles.formCard}>

            {/* Heading */}
            <View style={styles.heading}>
              <AppText style={styles.titleText}>
                {isOtpMode ? "Xác thực OTP" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              </AppText>
              <AppText style={styles.subtitleText}>
                {isOtpMode
                  ? "Nhập mã xác thực đã gửi đến số điện thoại."
                  : mode === "login"
                    ? "Chọn phương thức đăng nhập"
                    : "Bắt đầu hành trình ẩm thực của bạn."}
              </AppText>
            </View>

            {!isOtpMode ? (
              <View style={styles.methodTabs}>
                <Pressable
                  style={[styles.methodTab, !isPhone && styles.methodTabActive]}
                  onPress={() => setAuthMethod("email")}
                >
                  <AppText style={[styles.methodTabText, !isPhone && styles.methodTabTextActive]}>Email</AppText>
                </Pressable>
                <Pressable
                  style={[styles.methodTab, isPhone && styles.methodTabActive]}
                  onPress={() => setAuthMethod("phone")}
                >
                  <AppText style={[styles.methodTabText, isPhone && styles.methodTabTextActive]}>Số điện thoại</AppText>
                </Pressable>
              </View>
            ) : null}

            {/* Section header */}
            {mode === "login" ? (
              <AppText style={styles.sectionHeader}>
                Đăng nhập vào tk hiện có
              </AppText>
            ) : null}

            {/* Form */}
            {mode === "register" || (isOtpMode && requiresPasswordSetup) ? (
              <FigmaField label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} placeholder="Nguyễn Văn A" autoCapitalize="words" />
            ) : null}

            {isPhone ? (
              <FigmaField
                label="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="Nhập số điện thoại"
              />
            ) : (
              <FigmaField
                label={mode === "login" ? "Tên đăng nhập" : "Email"}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={mode === "login" ? "Nhập tên đăng nhập" : "email@example.com"}
              />
            )}

            {isOtpMode ? (
              <FigmaField
                label="Mã OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Nhập mã 6 chữ số"
              />
            ) : null}

            {!isOtpMode || requiresPasswordSetup ? (
              <FigmaField
                label={requiresPasswordSetup ? "Tạo mật khẩu" : "Mật khẩu"}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={requiresPasswordSetup ? "Tạo mật khẩu cho tài khoản" : "Nhập mật khẩu"}
              />
            ) : null}

            <View style={styles.primaryAction}>
              <AppButton
                label={isOtpMode ? "Xác thực" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                onPress={submit}
                loading={loading}
              />
            </View>

            {isPhone && !isOtpMode ? (
              <Pressable style={styles.otpLinkWrap} onPress={startPhoneOtp} disabled={loading}>
                <AppText style={styles.switchLink}>Đăng nhập bằng mã OTP</AppText>
              </Pressable>
            ) : null}

            {isOtpMode ? (
              <Pressable style={styles.otpLinkWrap} onPress={() => setMode("login")} disabled={loading}>
                <AppText style={styles.switchLink}>Quay lại đăng nhập mật khẩu</AppText>
              </Pressable>
            ) : null}

            {!isOtpMode ? <Pressable onPress={toggleMode}>
              <AppText style={styles.switchText}>
                {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <AppText style={styles.switchLink}>
                  {mode === "login" ? "Tạo tài khoản" : "Đăng nhập"}
                </AppText>
              </AppText>
            </Pressable> : null}

            {/* Divider label */}
            <AppText style={styles.otherLoginText}>
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FigmaLineBackground>
  );
}

type FigmaFieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function FigmaField({ label, style, ...props }: FigmaFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        placeholderTextColor="rgba(0, 0, 0, 0.41)"
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
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 170,
    flexGrow: 1,
    minHeight: 812
  },
  formCard: {
    gap: 0,
    zIndex: 2
  },

  heading: {
    gap: 8,
    marginTop: 22,
    marginBottom: 25
  },
  titleText: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.ink
  },
  subtitleText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ink
  },
  sectionHeader: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ink,
    marginBottom: 5
  },
  methodTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 18,
    padding: 4,
    marginBottom: 16,
    gap: 4
  },
  methodTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  methodTabActive: {
    backgroundColor: colors.green
  },
  methodTabText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted
  },
  methodTabTextActive: {
    color: colors.white
  },
  fieldWrap: {
    gap: 9,
    marginBottom: 17
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 15,
    color: "rgba(68, 68, 68, 0.68)"
  },
  figmaInput: {
    height: 40,
    borderRadius: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 15.5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  primaryAction: {
    marginTop: 1,
    marginBottom: 11
  },
  switchText: {
    textAlign: "center",
    color: colors.muted
  },
  switchLink: {
    color: colors.green,
    fontFamily: fonts.semibold
  },
  otpLinkWrap: {
    alignItems: "center",
    marginTop: -2,
    marginBottom: 10
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginTop: 11
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  otherLoginText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ink,
    marginTop: 11
  },
  foodCluster: {
    position: "absolute",
    left: -175,
    right: -145,
    bottom: -195,
    height: 438,
    zIndex: 0
  },
  foodImage: {
    position: "absolute",
    backgroundColor: "#C9C2AB",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12.5,
    shadowOffset: { width: -1, height: 5 },
    elevation: 4,
    transform: [{ rotate: "-15deg" }]
  },
  foodLeft: {
    left: 0,
    top: 4,
    width: 416,
    height: 436
  },
  foodCenter: {
    left: 190,
    top: 0,
    width: 296,
    height: 353,
    backgroundColor: "#D7D0B6"
  },
  foodRight: {
    right: 0,
    top: 40,
    width: 425,
    height: 439,
    backgroundColor: "#B7C0BC"
  }
});
