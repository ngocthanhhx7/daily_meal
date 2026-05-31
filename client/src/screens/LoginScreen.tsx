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
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export function LoginScreen() {
  const { signIn, signInWithPhone, register, registerWithPhone } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      if (mode === "login") {
        if (method === "phone") {
          await signInWithPhone(phone, password);
        } else {
          await signIn(email, password);
        }
      } else {
        if (method === "phone") {
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

  function placeholder() {
    setMethod("phone");
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
            <View style={styles.methodRow}>
              <Pressable
                style={[styles.methodButton, method === "email" && styles.methodButtonActive]}
                onPress={() => setMethod("email")}
              >
                <AppText style={[styles.methodText, method === "email" && styles.methodTextActive]}>Email</AppText>
              </Pressable>
              <Pressable
                style={[styles.methodButton, method === "phone" && styles.methodButtonActive]}
                onPress={() => setMethod("phone")}
              >
                <AppText style={[styles.methodText, method === "phone" && styles.methodTextActive]}>Số điện thoại</AppText>
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
            {method === "phone" ? (
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
                label={mode === "login" ? "Email" : "Email"}
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
              {(["logo-facebook", "mail-outline", "call-outline"] as const).map((icon) => (
                <Pressable
                  key={icon}
                  style={styles.socialButton}
                  onPress={icon === "call-outline" ? () => setMethod("phone") : placeholder}
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
  methodRow: {
    flexDirection: "row",
    gap: 10
  },
  methodButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.75)"
  },
  methodButtonActive: {
    backgroundColor: colors.green
  },
  methodText: {
    color: colors.green,
    fontFamily: fonts.semibold
  },
  methodTextActive: {
    color: colors.white
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
