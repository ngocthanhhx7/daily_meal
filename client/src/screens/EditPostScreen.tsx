import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

export function EditPostScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const post = route.params?.post;
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [tags, setTags] = useState(post?.tags?.join(", ") ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!token || !post?._id || post._id.startsWith("demo")) {
      navigation.goBack();
      return;
    }
    setLoading(true);
    try {
      await api.updatePost(token, post._id, {
        caption,
        tags: tags.split(",").map((tag: string) => tag.trim()).filter(Boolean)
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Không thể sửa bài", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!token || !post?._id || post._id.startsWith("demo")) {
      navigation.goBack();
      return;
    }
    await api.deletePost(token, post._id);
    navigation.navigate("Home");
  }

  return (
    <AppScreen>
      <Header title="Chỉnh sửa bài viết" onBack={() => navigation.goBack()} />
      <TextField label="Mô tả" value={caption} onChangeText={setCaption} multiline />
      <TextField label="Tags" value={tags} onChangeText={setTags} />
      <AppButton label="Lưu thay đổi" onPress={save} loading={loading} />
      <AppButton label="Xóa bài viết" variant="danger" onPress={remove} />
    </AppScreen>
  );
}

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

const styles = StyleSheet.create({
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
