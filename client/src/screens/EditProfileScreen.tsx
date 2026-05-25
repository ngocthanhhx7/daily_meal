import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Switch, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

type BirthdayVisibility = "hidden" | "dayMonth" | "full";

function mediaSource(uri?: string) {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith("http") || uri.startsWith("file:")) {
    return { uri };
  }

  return { uri: `${api.baseUrl}${uri}` };
}

const visibilityOptions: Array<{ value: BirthdayVisibility; label: string }> = [
  { value: "hidden", label: "Ẩn" },
  { value: "dayMonth", label: "Ngày/tháng" },
  { value: "full", label: "Đầy đủ" }
];

export function EditProfileScreen({ navigation }: any) {
  const { token, user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [birthday, setBirthday] = useState(user?.birthday?.date ?? "");
  const [birthdayVisibility, setBirthdayVisibility] = useState<BirthdayVisibility>(
    user?.birthday?.visibility ?? "hidden"
  );
  const [avatarUri, setAvatarUri] = useState(user?.avatarUrl ?? "");
  const [premium, setPremium] = useState(Boolean(user?.isPremium));
  const [loading, setLoading] = useState(false);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Cần quyền thư viện ảnh", "Cho phép Daily Meal truy cập ảnh để đổi avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function save() {
    if (!token) {
      return;
    }

    if (!displayName.trim()) {
      Alert.alert("Thiếu tên", "Tên hiển thị không được để trống.");
      return;
    }

    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      Alert.alert("Ngày sinh chưa đúng", "Vui lòng nhập theo định dạng YYYY-MM-DD.");
      return;
    }

    setLoading(true);
    try {
      let nextAvatarUrl = avatarUri;

      if (avatarUri.startsWith("file:")) {
        const upload = await api.uploadImage(token, avatarUri, "avatar");
        nextAvatarUrl = upload.upload.url;
      }

      await updateUser({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: nextAvatarUrl,
        isPremium: premium,
        birthday: {
          date: birthday,
          visibility: birthdayVisibility
        }
      });

      Alert.alert("Đã lưu hồ sơ", "Thông tin cá nhân đã được cập nhật.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Không thể lưu hồ sơ", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen keyboard>
      <AppText variant="title">Chỉnh sửa cá nhân</AppText>
      <Pressable style={styles.avatarBlock} onPress={pickAvatar}>
        {mediaSource(avatarUri) ? (
          <Image source={mediaSource(avatarUri)} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <AppText variant="title" style={styles.avatarText}>
              {displayName.slice(0, 1).toUpperCase() || "D"}
            </AppText>
          </View>
        )}
        <View style={styles.avatarCopy}>
          <AppText variant="button">Avatar</AppText>
          <AppText variant="caption" muted>
            Chọn ảnh từ máy để làm ảnh đại diện.
          </AppText>
        </View>
      </Pressable>

      <TextField label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} />
      <TextField label="Giới thiệu" value={bio} onChangeText={setBio} multiline />
      <TextField
        label="Ngày sinh (YYYY-MM-DD)"
        value={birthday}
        onChangeText={setBirthday}
        keyboardType="numbers-and-punctuation"
        placeholder="2003-12-31"
      />
      <View style={styles.section}>
        <AppText variant="button">Hiển thị ngày sinh</AppText>
        <View style={styles.segment}>
          {visibilityOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setBirthdayVisibility(option.value)}
              style={[
                styles.segmentItem,
                birthdayVisibility === option.value && styles.segmentItemActive
              ]}
            >
              <AppText
                variant="caption"
                style={birthdayVisibility === option.value ? styles.segmentLabelActive : undefined}
              >
                {option.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.premiumRow}>
        <View style={styles.premiumCopy}>
          <AppText variant="button">Daily premium</AppText>
          <AppText variant="caption" muted>
            Cờ phát triển để test sticker VIP và giới hạn upload.
          </AppText>
        </View>
        <Switch value={premium} onValueChange={setPremium} />
      </View>
      <AppButton label="Lưu hồ sơ" onPress={save} loading={loading} />
      <AppButton label="Hủy" variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.canvasStrong
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  avatarText: {
    color: colors.white
  },
  avatarCopy: {
    flex: 1,
    gap: 4
  },
  section: {
    gap: 8
  },
  segment: {
    flexDirection: "row",
    gap: 8
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  segmentItemActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  segmentLabelActive: {
    color: colors.white
  },
  premiumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  premiumCopy: {
    flex: 1,
    paddingRight: 12
  }
});
