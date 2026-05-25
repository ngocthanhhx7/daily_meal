import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { NutritionCard } from "../components/NutritionCard";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import type { Meal, Sticker, Upload } from "../types/api";
import { getPendingPickedImageUri, pickSingleImage } from "../utils/imagePicker";

export function CreatePostScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [includeRecipe, setIncludeRecipe] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | undefined>();
  const [meal, setMeal] = useState<Meal | undefined>(route?.params?.meal);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    api.stickers(token).then((result) => setStickers(result.stickers)).catch(() => setStickers([]));
  }, [token]);

  useEffect(() => {
    let mounted = true;

    getPendingPickedImageUri()
      .then((uri) => {
        if (!mounted || !uri) {
          return;
        }

        setImages((current) => (current.includes(uri) ? current : [...current, uri]));
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  async function pickImage(camera = false) {
    const maxImages = user?.isPremium ? 10 : 3;
    if (images.length >= maxImages) {
      Alert.alert("Giới hạn ảnh", `Tài khoản này được đăng tối đa ${maxImages} ảnh.`);
      return;
    }

    const uri = await pickSingleImage(camera ? "camera" : "library");

    if (uri) {
      setImages((current) => (current.includes(uri) ? current : [...current, uri]));
    }
  }

  async function analyzeFirstImage() {
    if (!token || !images[0]) {
      Alert.alert("Chưa có ảnh", "Chọn hoặc chụp một ảnh món ăn trước.");
      return;
    }
    setLoading(true);
    try {
      const upload = await api.uploadImage(token, images[0], "meal");
      const result = await api.analyzeMeal(token, upload.upload._id);
      setMeal(result.meal);
    } catch (error) {
      Alert.alert("Không thể tính calo", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!token || !images.length) {
      Alert.alert("Thiếu ảnh", "Bài viết cần ít nhất một ảnh.");
      return;
    }
    setLoading(true);
    try {
      const uploads: Upload[] = [];
      for (const uri of images) {
        const result = await api.uploadImage(token, uri, "post");
        uploads.push(result.upload);
      }
      const parsedIngredients = parseLines(ingredients);
      const parsedSteps = parseLines(steps);
      const recipe =
        includeRecipe || recipeTitle.trim() || parsedIngredients.length || parsedSteps.length
          ? {
              title: recipeTitle.trim() || caption.slice(0, 80),
              ingredients: parsedIngredients,
              steps: parsedSteps
            }
          : undefined;

      await api.createPost(token, {
        images: uploads.map((upload) => ({
          url: upload.url,
          localPath: upload.localPath,
          uploadId: upload._id
        })),
        caption,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        stickerId: selectedSticker,
        mealId: meal?._id,
        nutritionSummary: meal?.result.total,
        recipe,
        visibility: "public"
      });
      setImages([]);
      setCaption("");
      setTags("");
      setIncludeRecipe(false);
      setRecipeTitle("");
      setIngredients("");
      setSteps("");
      setMeal(undefined);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Không thể đăng bài", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function parseLines(value: string) {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return (
    <AppScreen>
      {/* Back header */}
      <View style={styles.screenHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <AppText variant="subtitle" style={styles.screenTitle}>Đăng ảnh & Calo</AppText>
        <View style={styles.backBtnPlaceholder} />
      </View>
      <View style={styles.actions}>
        <AppButton label="Chụp ảnh" onPress={() => pickImage(true)} variant="secondary" />
        <AppButton label="Chọn ảnh" onPress={() => pickImage(false)} variant="ghost" />
      </View>
      <View style={styles.previewRow}>
        {images.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.preview} />
        ))}
        {!images.length ? <View style={styles.emptyPreview}><AppText muted>Chưa có ảnh</AppText></View> : null}
      </View>
      <AppButton label="Tính calo bằng AI" onPress={analyzeFirstImage} loading={loading} variant="ghost" />
      <NutritionCard nutrition={meal?.result.total} />
      <TextField label="Mô tả" value={caption} onChangeText={setCaption} multiline />
      <TextField label="Tags, cách nhau bằng dấu phẩy" value={tags} onChangeText={setTags} />
      <View style={styles.recipeToggle}>
        <View style={styles.recipeCopy}>
          <AppText variant="button">Công thức của bạn</AppText>
          <AppText variant="caption" muted>
            Thêm nguyên liệu và cách làm khi bạn muốn chia sẻ công thức.
          </AppText>
        </View>
        <Switch value={includeRecipe} onValueChange={setIncludeRecipe} />
      </View>
      {includeRecipe ? (
        <View style={styles.recipeFields}>
          <TextField
            label="Tên công thức"
            value={recipeTitle}
            onChangeText={setRecipeTitle}
            placeholder={caption ? caption.slice(0, 80) : "Ví dụ: Cơm gà sốt mè"}
          />
          <TextField
            label="Nguyên liệu (mỗi dòng một nguyên liệu)"
            value={ingredients}
            onChangeText={setIngredients}
            multiline
            style={styles.multiline}
          />
          <TextField
            label="Cách làm (mỗi dòng một bước)"
            value={steps}
            onChangeText={setSteps}
            multiline
            style={styles.multiline}
          />
        </View>
      ) : null}
      <AppText variant="subtitle">Nhãn dán</AppText>
      <View style={styles.stickers}>
        {stickers.map((sticker) => {
          const locked = sticker.premiumOnly && !user?.isPremium;
          return (
            <Pressable
              key={sticker._id}
              disabled={locked}
              onPress={() => setSelectedSticker(sticker._id)}
              style={[
                styles.sticker,
                selectedSticker === sticker._id && styles.stickerSelected,
                locked && styles.locked
              ]}
            >
              <AppText variant="caption">{locked ? "VIP " : ""}{sticker.name}</AppText>
            </Pressable>
          );
        })}
      </View>
      <AppButton label="Đăng bài" onPress={publish} loading={loading} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  backBtnPlaceholder: { width: 40 },
  screenTitle: { flex: 1, textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  preview: {
    width: 96,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  emptyPreview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  stickers: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sticker: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  stickerSelected: {
    backgroundColor: colors.yellow,
    borderColor: colors.black
  },
  locked: {
    opacity: 0.45
  },
  recipeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  recipeCopy: {
    flex: 1,
    gap: 4
  },
  recipeFields: {
    gap: 12
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: 12
  }
});
