import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Switch, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { NutritionCard } from "../components/NutritionCard";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type {
  Meal,
  PostImageTransform,
  PostLayout,
  Sticker,
  StickerPlacement,
  Upload
} from "../types/api";
import { getPendingPickedImageUris, pickMultipleImages, pickSingleImage } from "../utils/imagePicker";
import { stickerImageSource } from "../utils/stickers";

const MAX_IMAGES = 3;
const DEFAULT_TRANSFORM: PostImageTransform = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0
};
const DEFAULT_STICKER: StickerPlacement = {
  x: 0.78,
  y: 0.78,
  scale: 1,
  rotation: 0
};

type Step = "capture" | "edit";

export function CreatePostScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const isPremium = Boolean(user?.isPremium);
  const [step, setStep] = useState<Step>("capture");
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [includeRecipe, setIncludeRecipe] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | undefined>();
  const [stickerPlacement, setStickerPlacement] = useState<StickerPlacement>(DEFAULT_STICKER);
  const [layout, setLayout] = useState<PostLayout>("stack");
  const [transforms, setTransforms] = useState<PostImageTransform[]>([]);
  const [meal, setMeal] = useState<Meal | undefined>(route?.params?.meal);
  const [loading, setLoading] = useState(false);

  const selectedStickerData = useMemo(
    () => stickers.find((sticker) => sticker._id === selectedSticker),
    [selectedSticker, stickers]
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    api.stickers(token).then((result) => setStickers(result.stickers)).catch(() => setStickers([]));
  }, [token]);

  useEffect(() => {
    let mounted = true;

    getPendingPickedImageUris()
      .then((uris) => {
        if (!mounted || !uris.length) {
          return;
        }

        appendImages(uris);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  function appendImages(nextUris: string[]) {
    setImages((current) => {
      const unique = nextUris.filter((uri) => uri && !current.includes(uri));
      const openSlots = MAX_IMAGES - current.length;
      const accepted = unique.slice(0, openSlots);

      if (unique.length > openSlots) {
        Alert.alert("Giới hạn ảnh", `Bạn chỉ có thể chọn tối đa ${MAX_IMAGES} ảnh cho một bài đăng.`);
      }

      if (!accepted.length) {
        return current;
      }

      setTransforms((currentTransforms) => [
        ...currentTransforms,
        ...accepted.map(() => ({ ...DEFAULT_TRANSFORM }))
      ]);
      setSelectedIndex(current.length);
      return [...current, ...accepted];
    });
  }

  async function captureImage() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert("Đã đủ ảnh", `Bài đăng tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    const uri = await pickSingleImage("camera");

    if (uri) {
      appendImages([uri]);
    }
  }

  async function chooseFromLibrary() {
    if (!isPremium) {
      Alert.alert("Chỉ dành cho VIP", "Tài khoản free chỉ có thể chụp ảnh bằng camera.");
      return;
    }

    if (images.length >= MAX_IMAGES) {
      Alert.alert("Đã đủ ảnh", `Bài đăng tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    const uris = await pickMultipleImages(MAX_IMAGES - images.length);
    appendImages(uris);
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setTransforms((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedIndex((current) => Math.max(0, Math.min(current, images.length - 2)));
  }

  function updateSelectedTransform(patch: Partial<PostImageTransform>) {
    setTransforms((current) =>
      current.map((transform, index) =>
        index === selectedIndex
          ? {
              ...transform,
              ...patch,
              scale: clamp(patch.scale ?? transform.scale, 0.5, 3),
              rotation: clamp(patch.rotation ?? transform.rotation, -180, 180),
              offsetX: clamp(patch.offsetX ?? transform.offsetX, -120, 120),
              offsetY: clamp(patch.offsetY ?? transform.offsetY, -120, 120)
            }
          : transform
      )
    );
  }

  function updateStickerPlacement(patch: Partial<StickerPlacement>) {
    setStickerPlacement((current) => ({
      ...current,
      ...patch,
      x: clamp(patch.x ?? current.x, 0, 1),
      y: clamp(patch.y ?? current.y, 0, 1),
      scale: clamp(patch.scale ?? current.scale, 0.5, 2),
      rotation: clamp(patch.rotation ?? current.rotation, -180, 180)
    }));
  }

  async function analyzeFirstImage() {
    if (!token || !images[0]) {
      Alert.alert("Chưa có ảnh", "Chụp hoặc chọn một ảnh món ăn trước.");
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
        layout: isPremium ? layout : "stack",
        imageTransforms: isPremium
          ? images.map((_, index) => transforms[index] ?? DEFAULT_TRANSFORM)
          : images.map(() => DEFAULT_TRANSFORM),
        caption,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        stickerId: isPremium ? selectedSticker : undefined,
        stickerPlacement: isPremium && selectedSticker ? stickerPlacement : undefined,
        mealId: meal?._id,
        nutritionSummary: meal?.result.total,
        recipe,
        visibility: "public"
      });
      resetDraft();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Không thể đăng bài", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function resetDraft() {
    setImages([]);
    setTransforms([]);
    setCaption("");
    setTags("");
    setIncludeRecipe(false);
    setRecipeTitle("");
    setIngredients("");
    setSteps("");
    setMeal(undefined);
    setSelectedSticker(undefined);
    setStickerPlacement(DEFAULT_STICKER);
    setLayout("stack");
    setStep("capture");
  }

  function parseLines(value: string) {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function goBack() {
    if (step === "edit") {
      setStep("capture");
      return;
    }
    navigation.goBack();
  }

  return (
    <AppScreen style={styles.screen}>
      <Header title={step === "capture" ? "Thêm bài viết" : "Chỉnh bài viết"} onBack={goBack} />

      {step === "capture" ? (
        <>
          <PostPreview
            images={images}
            layout="stack"
            transforms={transforms}
            sticker={undefined}
            stickerPlacement={stickerPlacement}
            selectedIndex={selectedIndex}
            onSelectImage={setSelectedIndex}
          />

          <View style={styles.captureMetaRow}>
            <AppText variant="caption" style={styles.recentLabel}>Mới đây</AppText>
            {isPremium ? (
              <Pressable onPress={chooseFromLibrary} hitSlop={8}>
                <AppText variant="caption" style={styles.libraryLink}>Chọn từ album</AppText>
              </Pressable>
            ) : (
              <AppText variant="caption" muted>Free: chỉ chụp camera</AppText>
            )}
          </View>

          <View style={styles.captureStrip}>
            <View style={styles.thumbnailRail}>
              {images.map((uri, index) => (
                <Pressable
                  key={uri}
                  style={[styles.thumbnail, selectedIndex === index && styles.thumbnailActive]}
                  onPress={() => setSelectedIndex(index)}
                >
                  <Image source={{ uri }} style={styles.thumbnailImage} />
                  <View style={styles.thumbnailBadge}>
                    <AppText variant="caption" style={styles.thumbnailBadgeText}>{index + 1}</AppText>
                  </View>
                  <Pressable style={styles.removeThumb} onPress={() => removeImage(index)}>
                    <Ionicons name="close" size={12} color={colors.white} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.shutterButton} onPress={captureImage}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable
              style={[styles.nextButton, !images.length && styles.nextButtonDisabled]}
              disabled={!images.length}
              onPress={() => setStep("edit")}
            >
              <AppText variant="caption" style={styles.nextButtonText}>Tiếp tục</AppText>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <PostPreview
            images={images}
            layout={isPremium ? layout : "stack"}
            transforms={transforms}
            sticker={isPremium ? selectedStickerData : undefined}
            stickerPlacement={stickerPlacement}
            selectedIndex={selectedIndex}
            onSelectImage={setSelectedIndex}
          />

          <View style={styles.editRail}>
            {images.map((uri, index) => (
              <Pressable
                key={uri}
                style={[styles.editThumb, selectedIndex === index && styles.editThumbActive]}
                onPress={() => setSelectedIndex(index)}
              >
                <Image source={{ uri }} style={styles.editThumbImage} />
                <AppText variant="caption" style={styles.editThumbIndex}>{index + 1}</AppText>
              </Pressable>
            ))}
          </View>

          {isPremium ? (
            <>
              <View style={styles.toolSection}>
                <AppText variant="button">Bố cục</AppText>
                <View style={styles.segmentRow}>
                  {(["stack", "grid", "cascade"] as PostLayout[]).map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setLayout(item)}
                      style={[styles.segment, layout === item && styles.segmentActive]}
                    >
                      <AppText
                        variant="caption"
                        style={layout === item ? styles.segmentTextActive : undefined}
                      >
                        {layoutLabel(item)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.toolSection}>
                <AppText variant="button">Ảnh {selectedIndex + 1}</AppText>
                <View style={styles.controlGrid}>
                  <ControlButton
                    icon="remove"
                    label="Thu"
                    onPress={() =>
                      updateSelectedTransform({ scale: (transforms[selectedIndex]?.scale ?? 1) - 0.1 })
                    }
                  />
                  <ControlButton
                    icon="add"
                    label="Phóng"
                    onPress={() =>
                      updateSelectedTransform({ scale: (transforms[selectedIndex]?.scale ?? 1) + 0.1 })
                    }
                  />
                  <ControlButton
                    icon="refresh"
                    label="Xoay"
                    onPress={() =>
                      updateSelectedTransform({ rotation: (transforms[selectedIndex]?.rotation ?? 0) + 15 })
                    }
                  />
                  <ControlButton
                    icon="arrow-up"
                    label="Lên"
                    onPress={() =>
                      updateSelectedTransform({ offsetY: (transforms[selectedIndex]?.offsetY ?? 0) - 8 })
                    }
                  />
                  <ControlButton
                    icon="arrow-down"
                    label="Xuống"
                    onPress={() =>
                      updateSelectedTransform({ offsetY: (transforms[selectedIndex]?.offsetY ?? 0) + 8 })
                    }
                  />
                  <ControlButton
                    icon="arrow-forward"
                    label="Phải"
                    onPress={() =>
                      updateSelectedTransform({ offsetX: (transforms[selectedIndex]?.offsetX ?? 0) + 8 })
                    }
                  />
                </View>
              </View>

              <View style={styles.toolSection}>
                <AppText variant="button">Nhãn dán VIP</AppText>
                <View style={styles.stickerRow}>
                  {stickers.map((sticker) => {
                    const locked = sticker.premiumOnly && !isPremium;
                    const source = stickerImageSource(sticker);
                    return (
                      <Pressable
                        key={sticker._id}
                        disabled={locked}
                        onPress={() => setSelectedSticker((current) => current === sticker._id ? undefined : sticker._id)}
                        style={[
                          styles.stickerTile,
                          selectedSticker === sticker._id && styles.stickerTileActive,
                          locked && styles.locked
                        ]}
                      >
                        {source ? <Image source={source} style={styles.stickerImage} /> : null}
                        <AppText variant="caption" numberOfLines={1}>
                          {sticker.name}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedSticker ? (
                  <View style={styles.controlGrid}>
                    <ControlButton
                      icon="remove"
                      label="Thu"
                      onPress={() => updateStickerPlacement({ scale: stickerPlacement.scale - 0.1 })}
                    />
                    <ControlButton
                      icon="add"
                      label="Phóng"
                      onPress={() => updateStickerPlacement({ scale: stickerPlacement.scale + 0.1 })}
                    />
                    <ControlButton
                      icon="refresh"
                      label="Xoay"
                      onPress={() => updateStickerPlacement({ rotation: stickerPlacement.rotation + 15 })}
                    />
                    <ControlButton
                      icon="arrow-up"
                      label="Lên"
                      onPress={() => updateStickerPlacement({ y: stickerPlacement.y - 0.06 })}
                    />
                    <ControlButton
                      icon="arrow-down"
                      label="Xuống"
                      onPress={() => updateStickerPlacement({ y: stickerPlacement.y + 0.06 })}
                    />
                    <ControlButton
                      icon="arrow-forward"
                      label="Phải"
                      onPress={() => updateStickerPlacement({ x: stickerPlacement.x + 0.06 })}
                    />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

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
          <AppButton label="Đăng bài" onPress={publish} loading={loading} />
        </>
      )}
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

function PostPreview({
  images,
  layout,
  transforms,
  sticker,
  stickerPlacement,
  selectedIndex,
  onSelectImage
}: {
  images: string[];
  layout: PostLayout;
  transforms: PostImageTransform[];
  sticker?: Sticker;
  stickerPlacement: StickerPlacement;
  selectedIndex: number;
  onSelectImage?: (index: number) => void;
}) {
  const stickerSource = stickerImageSource(sticker);

  return (
    <View style={styles.previewStage}>
      {images.length ? (
        <View style={styles.artworkCanvas}>
          {images.map((uri, index) => {
            const { baseRotation, ...position } = imagePosition(layout, images.length, index);
            const transform = transforms[index] ?? DEFAULT_TRANSFORM;
            return (
              <Pressable
                key={uri}
                style={[
                  styles.artworkImageWrap,
                  position,
                  selectedIndex === index && styles.artworkSelected,
                  {
                    zIndex: 10 + index,
                    transform: [
                      { translateX: transform.offsetX },
                      { translateY: transform.offsetY },
                      { rotate: `${baseRotation + transform.rotation}deg` },
                      { scale: transform.scale }
                    ]
                  }
                ]}
                onPress={() => onSelectImage?.(index)}
              >
                <Image source={{ uri }} style={styles.artworkImage} />
                {images.length > 1 ? (
                  <View style={styles.artworkOrderBadge}>
                    <AppText variant="caption" style={styles.artworkOrderText}>{index + 1}</AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {stickerSource ? (
            <Image
              source={stickerSource}
              style={[
                styles.previewSticker,
                {
                  left: `${stickerPlacement.x * 100}%`,
                  top: `${stickerPlacement.y * 100}%`,
                  transform: [
                    { translateX: -28 },
                    { translateY: -28 },
                    { rotate: `${stickerPlacement.rotation}deg` },
                    { scale: stickerPlacement.scale }
                  ]
                }
              ]}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyStage}>
          <Ionicons name="camera" size={34} color={colors.yellow} />
        </View>
      )}
    </View>
  );
}

function imagePosition(layout: PostLayout, count: number, index: number) {
  if (count === 1) {
    return { width: "88%" as const, height: "88%" as const, left: "6%" as const, top: "6%" as const, baseRotation: 0 };
  }

  if (layout === "grid") {
    if (count === 2) {
      return [
        { width: "48%" as const, height: "74%" as const, left: "2%" as const, top: "13%" as const, baseRotation: -1 },
        { width: "48%" as const, height: "74%" as const, left: "50%" as const, top: "13%" as const, baseRotation: 1 }
      ][index];
    }

    return [
      { width: "58%" as const, height: "58%" as const, left: "2%" as const, top: "9%" as const, baseRotation: -1 },
      { width: "45%" as const, height: "45%" as const, left: "53%" as const, top: "19%" as const, baseRotation: 2 },
      { width: "38%" as const, height: "38%" as const, left: "31%" as const, top: "57%" as const, baseRotation: -3 }
    ][index];
  }

  if (layout === "cascade") {
    return [
      { width: "70%" as const, height: "70%" as const, left: "6%" as const, top: "8%" as const, baseRotation: -6 },
      { width: "70%" as const, height: "70%" as const, left: "19%" as const, top: "16%" as const, baseRotation: 4 },
      { width: "58%" as const, height: "58%" as const, left: "36%" as const, top: "30%" as const, baseRotation: 8 }
    ][index];
  }

  return [
    { width: "74%" as const, height: "74%" as const, left: "11%" as const, top: "12%" as const, baseRotation: -4 },
    { width: "74%" as const, height: "74%" as const, left: "16%" as const, top: "8%" as const, baseRotation: 5 },
    { width: "74%" as const, height: "74%" as const, left: "13%" as const, top: "15%" as const, baseRotation: 0 }
  ][index];
}

function ControlButton({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.controlButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={colors.ink} />
      <AppText variant="caption" numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

function layoutLabel(layout: PostLayout) {
  if (layout === "grid") return "Lưới";
  if (layout === "cascade") return "Chéo";
  return "Chồng";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(value.toFixed(2))));
}

const styles = StyleSheet.create({
  screen: {
    gap: 14
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
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
  },
  previewStage: {
    width: "100%",
    aspectRatio: 0.84,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.30)",
    overflow: "hidden"
  },
  artworkCanvas: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  emptyStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  artworkImageWrap: {
    position: "absolute",
    borderRadius: 16,
    backgroundColor: colors.canvasStrong,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6
  },
  artworkSelected: {
    borderWidth: 2,
    borderColor: colors.yellow
  },
  artworkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16
  },
  artworkOrderBadge: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line
  },
  artworkOrderText: {
    color: colors.black,
    fontFamily: fonts.bold
  },
  previewSticker: {
    position: "absolute",
    width: 64,
    height: 64,
    zIndex: 80
  },
  captureMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  recentLabel: {
    color: colors.black,
    fontFamily: fonts.semibold
  },
  libraryLink: {
    color: colors.muted,
    textDecorationLine: "underline"
  },
  captureStrip: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  thumbnailRail: {
    flex: 1,
    flexDirection: "row",
    gap: 8
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.canvasStrong
  },
  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.yellow
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12
  },
  thumbnailBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  thumbnailBadgeText: {
    fontSize: 9,
    color: colors.black,
    fontFamily: fonts.bold
  },
  removeThumb: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  shutterButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.canvasStrong
  },
  nextButton: {
    minWidth: 70,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue
  },
  nextButtonDisabled: {
    opacity: 0.42
  },
  nextButtonText: {
    color: colors.black,
    fontFamily: fonts.semibold
  },
  editRail: {
    flexDirection: "row",
    gap: 8
  },
  editThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.canvasStrong
  },
  editThumbActive: {
    borderWidth: 2,
    borderColor: colors.yellow
  },
  editThumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12
  },
  editThumbIndex: {
    position: "absolute",
    right: 4,
    bottom: 2,
    color: colors.white,
    fontFamily: fonts.bold
  },
  toolSection: {
    gap: 9
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  segmentActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  segmentTextActive: {
    color: colors.white
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  controlButton: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  stickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  stickerTile: {
    width: 76,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 6
  },
  stickerTileActive: {
    borderColor: colors.black,
    backgroundColor: colors.yellow
  },
  locked: {
    opacity: 0.4
  },
  stickerImage: {
    width: 42,
    height: 42
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
