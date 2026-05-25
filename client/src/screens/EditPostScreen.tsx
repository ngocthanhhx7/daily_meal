import React, { useState } from "react";
import { Alert } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";

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
      <AppText variant="title">Chỉnh sửa bài viết</AppText>
      <TextField label="Mô tả" value={caption} onChangeText={setCaption} multiline />
      <TextField label="Tags" value={tags} onChangeText={setTags} />
      <AppButton label="Lưu thay đổi" onPress={save} loading={loading} />
      <AppButton label="Xóa bài viết" variant="danger" onPress={remove} />
    </AppScreen>
  );
}
