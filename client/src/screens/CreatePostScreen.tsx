import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, PanResponder, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
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

const RECENT_PHOTOS = [
  require("../../assets/figma-snapshots/image1.png"),
  require("../../assets/figma-snapshots/image2.png"),
  require("../../assets/figma-snapshots/image3.png"),
  require("../../assets/figma-snapshots/image4.png"),
  require("../../assets/figma-snapshots/image5.png"),
  require("../../assets/figma-snapshots/image6.png"),
  require("../../assets/figma-snapshots/image7.png"),
  require("../../assets/figma-snapshots/image8.png"),
  require("../../assets/figma-snapshots/image9.png"),
  require("../../assets/figma-snapshots/image10.png")
];


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

  const recentUris = useMemo(() => {
    return RECENT_PHOTOS.map((asset) => Image.resolveAssetSource(asset).uri);
  }, []);

  useEffect(() => {
    // Automatically select the first recent photo on mount if selection is empty
    if (images.length === 0 && recentUris.length > 0) {
      setImages([recentUris[0]]);
      setTransforms([{ ...DEFAULT_TRANSFORM }]);
      setSelectedIndex(0);
    }
  }, [recentUris]);


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

  function handleSelectRecentPhoto(uri: string) {
    const existingIndex = images.indexOf(uri);
    if (existingIndex > -1) {
      removeImage(existingIndex);
    } else {
      if (images.length >= MAX_IMAGES) {
        Alert.alert("Giới hạn ảnh", `Bài đăng tối đa ${MAX_IMAGES} ảnh.`);
        return;
      }
      appendImages([uri]);
    }
  }

  function handleSwapImages(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length) {
      return;
    }
    setImages((current) => {
      const next = [...current];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
    setTransforms((current) => {
      const next = [...current];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
    setSelectedIndex(toIndex);
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
            onCameraPress={captureImage}
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recentScroll}
            contentContainerStyle={styles.recentRail}
          >
            {recentUris.map((uri) => {
              const isSelected = images.includes(uri);
              const selectedIdx = images.indexOf(uri);
              const isActive = images[selectedIndex] === uri;

              return (
                <Pressable
                  key={uri}
                  style={[
                    styles.recentThumb,
                    isActive && styles.recentThumbActive
                  ]}
                  onPress={() => handleSelectRecentPhoto(uri)}
                >
                  <Image source={{ uri }} style={styles.recentThumbImage} />
                  {isSelected && (
                    <>
                      <View style={styles.thumbnailOverlay} />
                      <View style={styles.thumbnailCenterBadge}>
                        <View style={styles.thumbnailCenterBadgeCircle}>
                          <AppText variant="caption" style={styles.thumbnailCenterBadgeText}>
                            {selectedIdx + 1}
                          </AppText>
                        </View>
                      </View>
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.captureControlBar}>
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
            layout="stack"
            transforms={transforms}
            sticker={undefined}
            stickerPlacement={stickerPlacement}
            selectedIndex={selectedIndex}
            onSelectImage={setSelectedIndex}
          />

          <View style={styles.editRail}>
            {images.map((uri, index) => (
              <DraggableEditThumb
                key={uri}
                uri={uri}
                index={index}
                isActive={selectedIndex === index}
                onPress={() => setSelectedIndex(index)}
                onSwap={handleSwapImages}
              />
            ))}
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
  onSelectImage,
  onCameraPress
}: {
  images: string[];
  layout: PostLayout;
  transforms: PostImageTransform[];
  sticker?: Sticker;
  stickerPlacement: StickerPlacement;
  selectedIndex: number;
  onSelectImage?: (index: number) => void;
  onCameraPress?: () => void;
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
                    zIndex: selectedIndex === index ? 50 : 10 + index,
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
          {/* Glassmorphic camera button overlayed in the center */}
          <Pressable style={styles.centerCameraBtn} onPress={onCameraPress} hitSlop={8}>
            <Ionicons name="camera" size={24} color={colors.white} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.emptyStage} onPress={onCameraPress}>
          <View style={styles.centerCameraBtn}>
            <Ionicons name="camera" size={24} color={colors.white} />
          </View>
        </Pressable>
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

function DraggableEditThumb({
  uri,
  index,
  isActive,
  onPress,
  onSwap
}: {
  uri: string;
  index: number;
  isActive: boolean;
  onPress: () => void;
  onSwap: (fromIndex: number, toIndex: number) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 40;
        if (gestureState.dx > threshold) {
          onSwap(index, index + 1);
        } else if (gestureState.dx < -threshold) {
          onSwap(index, index - 1);
        } else {
          onPress();
        }
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false
        }).start();
      }
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.editThumb,
        isActive && styles.editThumbActive,
        {
          transform: [{ translateX: pan.x }],
          zIndex: isActive ? 99 : 1
        }
      ]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri }} style={styles.editThumbImage} />
      <AppText variant="caption" style={styles.editThumbIndex}>
        {index + 1}
      </AppText>
    </Animated.View>
  );
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
    aspectRatio: 0.85,
    borderRadius: 24,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  artworkCanvas: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  emptyStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)"
  },
  centerCameraBtn: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -28 }, { translateY: -28 }],
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)"
  },
  artworkImageWrap: {
    position: "absolute",
    borderRadius: 24,
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
    borderRadius: 24
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
    alignItems: "center",
    marginTop: 6,
    marginBottom: 2
  },
  recentLabel: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 16
  },
  libraryLink: {
    color: colors.muted,
    textDecorationLine: "underline",
    fontSize: 14
  },
  recentScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginVertical: 4,
    minHeight: 72
  },
  recentRail: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 4
  },
  recentThumb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden",
    position: "relative"
  },
  recentThumbActive: {
    borderWidth: 2,
    borderColor: colors.green
  },
  recentThumbImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)"
  },
  thumbnailCenterBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  thumbnailCenterBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  thumbnailCenterBadgeText: {
    fontSize: 12,
    color: colors.black,
    fontFamily: fonts.bold
  },
  captureControlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    position: "relative",
    width: "100%",
    minHeight: 80
  },
  shutterButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)"
  },
  nextButton: {
    position: "absolute",
    right: 0,
    bottom: 16,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  nextButtonDisabled: {
    backgroundColor: "rgba(0,0,0,0.06)",
    opacity: 0.5
  },
  nextButtonText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14
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
