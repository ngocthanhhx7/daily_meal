import React, { useState } from "react";
import { Alert } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";

export function ChangePasswordScreen({ navigation }: any) {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!token) {
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Mật khẩu quá ngắn", "Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Mật khẩu chưa khớp", "Vui lòng nhập lại mật khẩu mới giống nhau.");
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(token, { currentPassword, newPassword });
      Alert.alert("Đã đổi mật khẩu", "Bạn có thể dùng mật khẩu mới từ lần đăng nhập tiếp theo.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Không thể đổi mật khẩu", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen keyboard>
      <AppText variant="title">Đổi mật khẩu</AppText>
      <TextField
        label="Mật khẩu hiện tại"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
      />
      <TextField
        label="Mật khẩu mới"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <TextField
        label="Nhập lại mật khẩu mới"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <AppButton label="Cập nhật mật khẩu" onPress={submit} loading={loading} />
      <AppButton label="Hủy" variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}
