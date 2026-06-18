import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { getFeedPostParams } from "../utils/postNavigation";
import { PostVideoPlayer } from "../components/PostVideoPlayer";

function imageSource(post: Post, index: number) {
  const url = post.images[index]?.url ?? post.images[0]?.url;
  if (!url) {
    return require("../../assets/figma-snapshots/image3.png");
  }

  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:") || url.startsWith("blob:")) {
    return { uri: url };
  }

  return { uri: `${api.baseUrl}${url}` };
}

function videoSource(post?: Post) {
  const url = post?.video?.url;
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:")) {
    return url;
  }
  return `${api.baseUrl}${url}`;
}

function hasRecipe(post?: Post) {
  return Boolean(
    post?.recipe?.title ||
      post?.recipe?.ingredients?.length ||
      post?.recipe?.steps?.length ||
      post?.recipes?.length
  );
}

export function EditPostScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const post = route.params?.post as Post | undefined;
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [tags, setTags] = useState(post?.tags?.join(", ") ?? "");
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function save() {
    if (!token || !post?._id || post._id.startsWith("demo")) {
      setEditOpen(false);
      return;
    }

    setLoading(true);
    try {
      await api.updatePost(token, post._id, {
        caption,
        tags: tags.split(",").map((tag: string) => tag.trim()).filter(Boolean)
      });
      setEditOpen(false);
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

    setLoading(true);
    try {
      await api.deletePost(token, post._id);
      navigation.navigate("Home");
    } catch (error) {
      Alert.alert("Không thể xóa bài", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function confirmRemove() {
    console.log("Xóa bài viết clicked for post:", post?._id);
    Alert.alert("Xóa bài viết", "Bài viết sẽ bị xóa khỏi Daily Meal.", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: remove }
    ]);
  }

  if (!post) {
    return (
      <AppScreen>
        <Header title="Bài viết" onBack={() => navigation.goBack()} />
        <AppText muted>Không tìm thấy bài viết.</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.screen}>
      <Header title="Bài viết" onBack={() => navigation.goBack()} />

      <View style={styles.preview}>
        <View style={styles.imageDeck}>
          {post.mediaType === "video" && videoSource(post) ? (
            <View style={[styles.imageCard, styles.imageCardMain]}>
              <PostVideoPlayer uri={videoSource(post)!} active style={styles.image} />
              <View style={styles.cameraBadge}>
                <Ionicons name="videocam" size={18} color={colors.white} />
              </View>
            </View>
          ) : (
            (post.images.length ? post.images.slice(0, 3) : [undefined]).map((_, index) => (
              <View
                key={`${post._id}-${index}`}
                style={[
                  styles.imageCard,
                  index === 0 && styles.imageCardMain,
                  index === 1 && styles.imageCardSecond,
                  index === 2 && styles.imageCardThird
                ]}
              >
                <Image source={imageSource(post, index)} style={styles.image} resizeMode="cover" />
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={18} color={colors.white} />
                </View>
                {post.images.length > 1 ? (
                  <View style={styles.indexBadge}>
                    <AppText style={styles.indexText}>{index + 1}</AppText>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.captionCard}>
          <AppText style={styles.captionTitle} numberOfLines={2}>
            {post.caption || post.recipe?.title || "Bài viết Daily Meal"}
          </AppText>
          <AppText muted style={styles.captionMeta}>
            {new Date(post.createdAt).toLocaleDateString("vi-VN")} · {post.visibility}
          </AppText>
        </View>
      </View>

      <View style={styles.actionList}>
        <ActionRow
          icon="navigate-circle-outline"
          title="Xem trong bảng tin"
          subtitle="Mở đúng bài đăng này trong luồng bảng tin"
          onPress={() => navigation.navigate("Home", getFeedPostParams(post))}
        />
        <ActionRow
          icon="create-outline"
          title="Chỉnh sửa nội dung"
          subtitle="Sửa mô tả và thẻ của bài viết"
          onPress={() => setEditOpen(true)}
        />
        {hasRecipe(post) ? (
          <ActionRow
            icon="restaurant-outline"
            title="Xem công thức"
            subtitle="Mở phần công thức đã gắn với bài"
            onPress={() => navigation.navigate("Recipe", { post })}
          />
        ) : null}
        <ActionRow
          icon="trash-outline"
          title="Xóa bài viết"
          subtitle="Gỡ bài này khỏi hồ sơ của bạn"
          danger
          onPress={confirmRemove}
        />
      </View>

      <EditDetailsModal
        visible={editOpen}
        caption={caption}
        tags={tags}
        loading={loading}
        onCaptionChange={setCaption}
        onTagsChange={setTags}
        onClose={() => setEditOpen(false)}
        onSave={save}
      />
    </AppScreen>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={18} color={colors.white} />
      </Pressable>
      <AppText variant="title" style={styles.screenTitle} numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  danger,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        <Ionicons name={icon} size={22} color={danger ? colors.red : colors.black} />
      </View>
      <View style={styles.actionCopy}>
        <AppText style={[styles.actionTitle, danger && styles.dangerText]}>{title}</AppText>
        <AppText muted style={styles.actionSubtitle} numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function EditDetailsModal({
  visible,
  caption,
  tags,
  loading,
  onCaptionChange,
  onTagsChange,
  onClose,
  onSave
}: {
  visible: boolean;
  caption: string;
  tags: string;
  loading: boolean;
  onCaptionChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.editSheet}>
          <View style={styles.sheetHandle} />
          <AppText variant="subtitle" style={styles.sheetTitle}>Chỉnh sửa nội dung</AppText>
          <TextField label="Mô tả" value={caption} onChangeText={onCaptionChange} multiline />
          <TextField label="Tags" value={tags} onChangeText={onTagsChange} />
          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <AppText variant="button" style={styles.cancelButtonText}>Hủy</AppText>
            </Pressable>
            <AppButton label="Lưu" onPress={onSave} loading={loading} style={styles.sheetButton} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 18,
    paddingBottom: 48
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  backBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  screenTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    color: colors.black
  },
  preview: {
    gap: 14
  },
  imageDeck: {
    minHeight: 270,
    alignItems: "center",
    justifyContent: "center"
  },
  imageCard: {
    position: "absolute",
    width: "74%",
    maxWidth: 280,
    aspectRatio: 0.78,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.canvasStrong,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6
  },
  imageCardMain: {
    zIndex: 3
  },
  imageCardSecond: {
    right: 16,
    transform: [{ rotate: "4deg" }],
    opacity: 0.86,
    zIndex: 2
  },
  imageCardThird: {
    left: 16,
    transform: [{ rotate: "-4deg" }],
    opacity: 0.72,
    zIndex: 1
  },
  image: {
    width: "100%",
    height: "100%"
  },
  cameraBadge: {
    position: "absolute",
    top: "43%",
    left: "50%",
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  indexBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  indexText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 11
  },
  captionCard: {
    alignSelf: "center",
    maxWidth: "92%",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  captionTitle: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center"
  },
  captionMeta: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12
  },
  actionList: {
    gap: 10
  },
  actionRow: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  actionRowPressed: {
    opacity: 0.6
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas
  },
  actionIconDanger: {
    backgroundColor: "rgba(230,91,85,0.12)"
  },
  actionCopy: {
    flex: 1,
    minWidth: 0
  },
  actionTitle: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19
  },
  actionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16
  },
  dangerText: {
    color: colors.red
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.38)"
  },
  editSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: "center"
  },
  sheetTitle: {
    color: colors.black
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10
  },
  sheetButton: {
    flex: 1
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  cancelButtonText: {
    color: colors.ink
  }
});
