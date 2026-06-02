import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back-circle" size={18} color={colors.ink} />
      </Pressable>
      <AppText variant="title" style={styles.screenTitle} numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );
}

type BirthdayVisibility = "hidden" | "dayMonth" | "full";

const ACCENT_COLORS = [
  { value: "#8BA58A", label: "Xanh lá" },
  { value: "#F5B8B5", label: "Hồng đào" },
  { value: "#9BBAD4", label: "Xanh dương" },
  { value: "#E9D58E", label: "Vàng chanh" },
  { value: "#EBB390", label: "Cam sữa" },
  { value: "#CBB5F5", label: "Tím oải hương" },
  { value: "#74746F", label: "Xám đá" }
];

const CUTE_AVATARS = [
  { key: "cute_cat", label: "Mèo Noodle", source: require("../../assets/avatar/cute_cat.png") },
  { key: "cute_dog", label: "Cún Chef", source: require("../../assets/avatar/cute_dog.png") },
  { key: "cute_rabbit", label: "Thỏ Trà Sữa", source: require("../../assets/avatar/cute_rabbit.png") },
  { key: "cute_bear", label: "Gấu Bánh", source: require("../../assets/avatar/cute_bear.png") },
  { key: "cute_hamster", label: "Hamster Dâu", source: require("../../assets/avatar/cute_hamster.png") },
  { key: "cute_panda", label: "Trúc Sữa", source: require("../../assets/avatar/cute_panda.png") },
  { key: "cute_dino", label: "Dino Xanh", source: require("../../assets/avatar/cute_dino.png") },
  { key: "cute_koala", label: "Koala Cookie", source: require("../../assets/avatar/cute_koala.png") },
  { key: "cute_penguin", label: "Cụt Sushi", source: require("../../assets/avatar/cute_penguin.png") },
  { key: "cute_fox", label: "Cáo Cà Phê", source: require("../../assets/avatar/cute_fox.png") }
];

function mediaSource(uri?: string) {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith("http") || uri.startsWith("file:") || uri.startsWith("data:")) {
    return { uri };
  }

  if (uri.includes("assets/") || uri.includes("cute_")) {
    const name = uri.split("/").pop()?.replace(".png", "");
    switch (name) {
      case "cute_cat": return require("../../assets/avatar/cute_cat.png");
      case "cute_dog": return require("../../assets/avatar/cute_dog.png");
      case "cute_rabbit": return require("../../assets/avatar/cute_rabbit.png");
      case "cute_bear": return require("../../assets/avatar/cute_bear.png");
      case "cute_hamster": return require("../../assets/avatar/cute_hamster.png");
      case "cute_panda": return require("../../assets/avatar/cute_panda.png");
      case "cute_dino": return require("../../assets/avatar/cute_dino.png");
      case "cute_koala": return require("../../assets/avatar/cute_koala.png");
      case "cute_penguin": return require("../../assets/avatar/cute_penguin.png");
      case "cute_fox": return require("../../assets/avatar/cute_fox.png");
      default: break;
    }
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
  const [themeColor, setThemeColor] = useState(user?.themeColor ?? "#8BA58A");
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

      if (avatarUri.startsWith("file:") || avatarUri.startsWith("blob:") || avatarUri.startsWith("data:")) {
        const upload = await api.uploadImage(token, avatarUri, "avatar");
        nextAvatarUrl = upload.upload.url;
      }

      await updateUser({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: nextAvatarUrl,
        themeColor: themeColor,
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
      <Header title="Chỉnh sửa cá nhân" onBack={() => navigation.goBack()} />
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

      {/* ── SELECT CUTE AVATAR mẫu ── */}
      <View style={styles.section}>
        <AppText variant="button">Chọn Avatar mẫu dễ thương</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuteAvatarScroll}>
          {CUTE_AVATARS.map((item) => (
            <Pressable
              key={item.key}
              style={[
                styles.cuteAvatarCard,
                avatarUri === item.key && styles.cuteAvatarCardActive
              ]}
              onPress={() => setAvatarUri(item.key)}
            >
              <Image source={item.source} style={styles.cuteAvatarThumb} />
              <AppText variant="caption" style={styles.cuteAvatarLabel} numberOfLines={1}>
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── CHOOSE BACKGROUND COLOR ── */}
      <View style={styles.section}>
        <AppText variant="button">Màu nền bảng tên</AppText>
        <View style={styles.colorGrid}>
          {ACCENT_COLORS.map((color) => (
            <Pressable
              key={color.value}
              onPress={() => setThemeColor(color.value)}
              style={[
                styles.colorCircle,
                { backgroundColor: color.value },
                themeColor === color.value && styles.colorCircleActive
              ]}
            />
          ))}
        </View>
      </View>

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
  cuteAvatarScroll: {
    paddingVertical: 4,
    gap: 12
  },
  cuteAvatarCard: {
    width: 86,
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cuteAvatarCardActive: {
    borderColor: colors.black,
    backgroundColor: colors.canvas
  },
  cuteAvatarThumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
    backgroundColor: colors.canvasStrong
  },
  cuteAvatarLabel: {
    fontSize: 10,
    color: colors.black,
    textAlign: "center"
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingVertical: 4
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  colorCircleActive: {
    borderColor: colors.black,
    borderWidth: 3
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  screenTitle: {
    flex: 1,
    fontSize: 25,
    lineHeight: 31,
    color: colors.black
  }
});
