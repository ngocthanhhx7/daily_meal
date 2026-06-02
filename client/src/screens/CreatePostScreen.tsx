import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Image, PanResponder, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
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
  ImageRecipe,
  Meal,
  NutritionDetail,
  PostImageTransform,
  PostLayout,
  Sticker,
  StickerPlacement,
  Upload
} from "../types/api";
import { getPendingPickedImageUris, pickMultipleImages, pickSingleImage } from "../utils/imagePicker";
import { stickerImageSource } from "../utils/stickers";
import { resolveRecentPhotoUri } from "./createPostAssets";
import { combineNutritionTotals, mealToNutritionDetail } from "./postNutrition";

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

const RECENT_PHOTOS: any[] = [];

const DEFAULT_VIP_STICKERS: Sticker[] = [
  { _id: "v1", key: "apple", name: "Táo đỏ", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f34e/512.webp", premiumOnly: true },
  { _id: "v2", key: "pancake", name: "Bánh kếp", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f95e/512.webp", premiumOnly: true },
  { _id: "v3", key: "salad", name: "Xà lách", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f957/512.webp", premiumOnly: true },
  { _id: "v4", key: "noodles", name: "Mì ramen", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f35c/512.webp", premiumOnly: true },
  { _id: "v5", key: "cooking", name: "Chiên trứng", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f373/512.webp", premiumOnly: true },
  { _id: "v6", key: "heart-eyes", name: "Mê mẩn", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.webp", premiumOnly: true },
  { _id: "v7", key: "yum", name: "Ngon tuyệt", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60b/512.webp", premiumOnly: true },
  { _id: "v8", key: "sparkling", name: "Lấp lánh", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.webp", premiumOnly: true },
  { _id: "v9", key: "fire", name: "Nóng bỏng", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp", premiumOnly: true },
  { _id: "v10", key: "cute-cat", name: "Mèo con", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f431/512.webp", premiumOnly: true },
  { _id: "v11", key: "dino", name: "Khủng long", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f995/512.webp", premiumOnly: true },
  { _id: "v12", key: "bear", name: "Gấu trúc", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f43b/512.webp", premiumOnly: true },
  { _id: "v13", key: "rabbit", name: "Thỏ hồng", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f430/512.webp", premiumOnly: true },
  { _id: "v14", key: "hamburger", name: "Burger", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f354/512.webp", premiumOnly: true },
  { _id: "v15", key: "pizza", name: "Pizza", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.webp", premiumOnly: true },
  { _id: "v16", key: "cake", name: "Bánh kem", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f370/512.webp", premiumOnly: true },
  { _id: "v17", key: "strawberry", name: "Dâu tây", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f353/512.webp", premiumOnly: true },
  { _id: "v18", key: "coffee", name: "Cà phê", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.webp", premiumOnly: true },
  { _id: "v19", key: "taco", name: "Taco", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f32e/512.webp", premiumOnly: true },
  { _id: "v20", key: "sushi", name: "Sushi", assetPath: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f363/512.webp", premiumOnly: true }
];

type Step = "capture" | "edit" | "sticker";

export function CreatePostScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const isPremium = Boolean(user?.isPremium);
  const maxImagesLimit = isPremium ? 3 : 1;

  const screenWidth = Dimensions.get("window").width;
  const previewWidth = screenWidth - 40;
  const previewHeight = previewWidth / 0.85;

  const stickerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setStickerPlacement((current) => ({
          ...current,
          x: Math.max(0, Math.min(1, locationX / previewWidth)),
          y: Math.max(0, Math.min(1, locationY / previewHeight))
        }));
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setStickerPlacement((current) => ({
          ...current,
          x: Math.max(0, Math.min(1, locationX / previewWidth)),
          y: Math.max(0, Math.min(1, locationY / previewHeight))
        }));
      }
    })
  ).current;

  const [step, setStep] = useState<Step>("capture");
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [includeRecipe, setIncludeRecipe] = useState(false);
  const [perImageRecipes, setPerImageRecipes] = useState<Record<number, { title: string; ingredients: string; steps: string }>>({
    0: { title: "", ingredients: "", steps: "" },
    1: { title: "", ingredients: "", steps: "" },
    2: { title: "", ingredients: "", steps: "" }
  });
  const [recipeEditingIndex, setRecipeEditingIndex] = useState(0);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [customStickers, setCustomStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | undefined>();
  const [stickerPlacement, setStickerPlacement] = useState<StickerPlacement>(DEFAULT_STICKER);
  const [layout, setLayout] = useState<PostLayout>("stack");
  const [transforms, setTransforms] = useState<PostImageTransform[]>([]);
  const [nutritionDetails, setNutritionDetails] = useState<NutritionDetail[]>(() => {
    const routeMeal = route?.params?.meal as Meal | undefined;
    return routeMeal ? [mealToNutritionDetail(routeMeal, 0)] : [];
  });
  const [loading, setLoading] = useState(false);

  const recentUris = useMemo(() => {
    return RECENT_PHOTOS.map((asset) =>
      resolveRecentPhotoUri(asset, Image.resolveAssetSource)
    ).filter((uri): uri is string => Boolean(uri));
  }, []);

  const [localGalleryImages, setLocalGalleryImages] = useState<string[]>([]);
  const nutritionTotal = useMemo(() => combineNutritionTotals(nutritionDetails), [nutritionDetails]);

  useEffect(() => {
    if (recentUris.length > 0 && localGalleryImages.length === 0) {
      setLocalGalleryImages(recentUris);
    }
  }, [recentUris, localGalleryImages]);

  useEffect(() => {
    // Automatically select the first recent photo on mount if selection is empty
    if (images.length === 0 && recentUris.length > 0) {
      setImages([recentUris[0]]);
      setTransforms([{ ...DEFAULT_TRANSFORM }]);
      setSelectedIndex(0);
    }
  }, [recentUris]);

  const allStickers = useMemo(() => {
    const merged = [...customStickers, ...DEFAULT_VIP_STICKERS];
    const keys = new Set(merged.map(s => s.key));
    for (const s of stickers) {
      if (!keys.has(s.key)) {
        merged.push(s);
      }
    }
    return merged;
  }, [customStickers, stickers]);

  const selectedStickerData = useMemo(
    () => allStickers.find((sticker) => sticker._id === selectedSticker || sticker.key === selectedSticker),
    [selectedSticker, allStickers]
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
      const openSlots = maxImagesLimit - current.length;
      const accepted = unique.slice(0, openSlots);

      if (unique.length > openSlots) {
        Alert.alert("Giới hạn ảnh", isPremium ? `Tài khoản VIP chỉ có thể chọn tối đa 3 ảnh.` : `Tài khoản miễn phí chỉ được đăng tối đa 1 ảnh. Hãy nâng cấp VIP để đăng tới 3 ảnh!`);
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
      if (images.length >= maxImagesLimit) {
        Alert.alert("Giới hạn ảnh", isPremium ? `Bài đăng tối đa 3 ảnh cho tài khoản VIP.` : `Tài khoản miễn phí chỉ được đăng 1 ảnh mỗi bài viết. Hãy nâng cấp VIP để đăng tới 3 ảnh!`);
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
    setNutritionDetails((current) =>
      current.map((detail) => {
        if (detail.imageIndex === fromIndex) {
          return { ...detail, imageIndex: toIndex };
        }
        if (detail.imageIndex === toIndex) {
          return { ...detail, imageIndex: fromIndex };
        }
        return detail;
      })
    );
    setSelectedIndex(toIndex);
  }

  async function captureImage() {
    if (images.length >= maxImagesLimit) {
      Alert.alert("Đã đủ ảnh", isPremium ? `Bài đăng tối đa 3 ảnh cho tài khoản VIP.` : `Tài khoản miễn phí chỉ được đăng 1 ảnh mỗi bài viết. Hãy nâng cấp VIP để đăng tới 3 ảnh!`);
      return;
    }

    const uri = await pickSingleImage("camera");

    if (uri) {
      // Prioritize recently captured image: prepend to the local gallery list
      setLocalGalleryImages((current) => [uri, ...current]);
      appendImages([uri]);
    }
  }

  async function chooseFromLibrary() {
    if (!isPremium) {
      Alert.alert("Chỉ dành cho VIP", "Tài khoản free chỉ có thể chụp ảnh bằng camera.");
      return;
    }

    if (images.length >= maxImagesLimit) {
      Alert.alert("Đã đủ ảnh", `Bài đăng tối đa 3 ảnh cho tài khoản VIP.`);
      return;
    }

    const uris = await pickMultipleImages(maxImagesLimit - images.length);
    appendImages(uris);
  }

  async function handleUploadCustomSticker() {
    if (!isPremium) {
      Alert.alert("Chỉ dành cho VIP", "Tính năng tự tải nhãn dán chỉ dành cho tài khoản VIP.");
      return;
    }
    const uri = await pickSingleImage("library");
    if (uri) {
      const newSticker: Sticker = {
        _id: `custom-user-${Date.now()}`,
        key: `custom-user-${Date.now()}`,
        name: "Tự tải",
        assetPath: uri,
        premiumOnly: true
      };
      setCustomStickers((current) => [newSticker, ...current]);
      setSelectedSticker(newSticker._id);
    }
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setTransforms((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setNutritionDetails((current) =>
      current
        .filter((detail) => detail.imageIndex !== index)
        .map((detail) => ({
          ...detail,
          imageIndex: detail.imageIndex > index ? detail.imageIndex - 1 : detail.imageIndex
        }))
    );
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

  async function analyzeImages() {
    if (!token || !images.length) {
      Alert.alert("Chưa có ảnh", "Chụp hoặc chọn một ảnh món ăn trước.");
      return;
    }
    setLoading(true);
    const analyzedDetails: NutritionDetail[] = [];
    try {
      for (let index = 0; index < images.length; index += 1) {
        const upload = await api.uploadImage(token, images[index], "meal");
        const result = await api.analyzeMeal(token, upload.upload._id);
        analyzedDetails.push(mealToNutritionDetail(result.meal, index));
        setNutritionDetails((current) => [
          ...current.filter((detail) => detail.imageIndex !== index),
          mealToNutritionDetail(result.meal, index)
        ]);
      }
    } catch (error) {
      Alert.alert("Không thể tính calo", error instanceof Error ? error.message : "Thử lại sau");
      if (analyzedDetails.length) {
        setNutritionDetails((current) => [
          ...current.filter((detail) => !analyzedDetails.some((analyzed) => analyzed.imageIndex === detail.imageIndex)),
          ...analyzedDetails
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!token || !images.length) {
      Alert.alert("Thiếu ảnh", "Bài viết cần ít nhất một ảnh.");
      return;
    }
    if (!isPremium && user?.counts?.posts !== undefined && user.counts.posts >= 6) {
      Alert.alert("Đạt giới hạn bài đăng", "Tài khoản miễn phí chỉ được đăng tối đa 6 bài viết. Hãy nâng cấp VIP để đăng bài không giới hạn!");
      return;
    }
    setLoading(true);
    try {
      const uploads: Upload[] = [];
      for (const uri of images) {
        const result = await api.uploadImage(token, uri, "post");
        uploads.push(result.upload);
      }

      // Build per-image recipes array
      const recipes: ImageRecipe[] = [];
      if (includeRecipe) {
        for (let i = 0; i < images.length; i++) {
          const r = perImageRecipes[i];
          if (r && (r.title.trim() || r.ingredients.trim() || r.steps.trim())) {
            recipes.push({
              imageIndex: i,
              title: r.title.trim() || caption.slice(0, 80),
              ingredients: parseLines(r.ingredients),
              steps: parseLines(r.steps)
            });
          }
        }
      }

      // Legacy recipe field for backward compat (first image recipe)
      const firstRecipe = recipes.length > 0 ? recipes[0] : undefined;
      const legacyRecipe = firstRecipe
        ? {
            title: firstRecipe.title,
            ingredients: firstRecipe.ingredients,
            steps: firstRecipe.steps
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
        mealId: nutritionDetails[0]?.mealId,
        nutritionSummary: nutritionTotal,
        nutritionDetails,
        recipe: legacyRecipe,
        recipes,
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
    setPerImageRecipes({
      0: { title: "", ingredients: "", steps: "" },
      1: { title: "", ingredients: "", steps: "" },
      2: { title: "", ingredients: "", steps: "" }
    });
    setRecipeEditingIndex(0);
    setNutritionDetails([]);
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
    if (step === "sticker") {
      setStep("edit");
      return;
    }
    if (step === "edit") {
      setStep("capture");
      return;
    }
    navigation.goBack();
  }

  return (
    <AppScreen style={styles.screen}>
      <Header
        title={step === "capture" ? "Thêm bài viết" : step === "sticker" ? "Nhãn dán" : "Chỉnh bài viết"}
        onBack={goBack}
      />

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

          {(isPremium || localGalleryImages.length > 0) ? (
            <>
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
                {localGalleryImages.map((uri) => {
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
            </>
          ) : null}

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
      ) : step === "edit" ? (
        <>
          <PostPreview
            images={images}
            layout="stack"
            transforms={transforms}
            sticker={selectedStickerData}
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

          {/* Touch-drag sticker customization entry card */}
          {isPremium ? (
            <Pressable style={styles.addStickerCard} onPress={() => setStep("sticker")}>
              <AppText style={styles.addStickerText}>
                {selectedSticker ? `Nhãn dán: ${selectedStickerData?.name || "Đã chọn"}` : "Thêm nhãn dán"}
              </AppText>
            </Pressable>
          ) : null}

          <AppButton label="Tính calo từng ảnh bằng AI" onPress={analyzeImages} loading={loading} variant="ghost" />
          <NutritionCard nutrition={nutritionTotal} />
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
              {/* Image selector tabs */}
              {images.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeImageTabs}>
                  {images.map((uri, idx) => (
                    <Pressable
                      key={`recipe-tab-${idx}`}
                      style={[
                        styles.recipeImageTab,
                        recipeEditingIndex === idx && styles.recipeImageTabActive
                      ]}
                      onPress={() => setRecipeEditingIndex(idx)}
                    >
                      <Image source={{ uri }} style={styles.recipeTabImage} resizeMode="cover" />
                      <AppText style={[
                        styles.recipeTabLabel,
                        recipeEditingIndex === idx && styles.recipeTabLabelActive
                      ]}>
                        Ảnh {idx + 1}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <AppText variant="caption" style={styles.recipeImageHint}>
                {images.length > 1
                  ? `Công thức cho ảnh ${recipeEditingIndex + 1} / ${images.length}`
                  : "Công thức cho món ăn"}
              </AppText>

              <TextField
                label="Tên món"
                value={perImageRecipes[recipeEditingIndex]?.title ?? ""}
                onChangeText={(text) => setPerImageRecipes(prev => ({
                  ...prev,
                  [recipeEditingIndex]: { ...prev[recipeEditingIndex], title: text }
                }))}
                placeholder={caption ? caption.slice(0, 80) : "Ví dụ: Cơm gà sốt mè"}
              />
              <TextField
                label="Nguyên liệu (mỗi dòng một nguyên liệu)"
                value={perImageRecipes[recipeEditingIndex]?.ingredients ?? ""}
                onChangeText={(text) => setPerImageRecipes(prev => ({
                  ...prev,
                  [recipeEditingIndex]: { ...prev[recipeEditingIndex], ingredients: text }
                }))}
                multiline
                style={styles.multiline}
              />
              <TextField
                label="Cách làm (mỗi dòng một bước)"
                value={perImageRecipes[recipeEditingIndex]?.steps ?? ""}
                onChangeText={(text) => setPerImageRecipes(prev => ({
                  ...prev,
                  [recipeEditingIndex]: { ...prev[recipeEditingIndex], steps: text }
                }))}
                multiline
                style={styles.multiline}
              />
            </View>
          ) : null}
          <AppButton label="Đăng bài" onPress={publish} loading={loading} />
        </>
      ) : (
        <>
          {/* Interactive touch-dragging sticker placement screen */}
          <PostPreview
            images={images}
            layout="stack"
            transforms={transforms}
            sticker={selectedStickerData}
            stickerPlacement={stickerPlacement}
            selectedIndex={selectedIndex}
            onSelectImage={setSelectedIndex}
            panHandlers={stickerPanResponder.panHandlers}
          />

          <AppText variant="caption" style={styles.stickerTipText}>
            Chạm di chuyển ngón tay trên màn hình xem trước để chỉnh vị trí nhãn dán!
          </AppText>

          {/* Scale & rotation adjustment control bar */}
          <View style={styles.stickerControlRow}>
            <Pressable
              style={styles.stickerControlBtn}
              onPress={() => setStickerPlacement((curr) => ({ ...curr, scale: Math.max(0.5, curr.scale - 0.1) }))}
            >
              <Ionicons name="remove" size={16} color={colors.ink} />
              <AppText variant="caption" style={{ fontFamily: fonts.bold }}>Thu nhỏ</AppText>
            </Pressable>
            <Pressable
              style={styles.stickerControlBtn}
              onPress={() => setStickerPlacement((curr) => ({ ...curr, scale: Math.min(2.5, curr.scale + 0.1) }))}
            >
              <Ionicons name="add" size={16} color={colors.ink} />
              <AppText variant="caption" style={{ fontFamily: fonts.bold }}>Phóng to</AppText>
            </Pressable>
            <Pressable
              style={styles.stickerControlBtn}
              onPress={() => setStickerPlacement((curr) => ({ ...curr, rotation: (curr.rotation + 15) % 360 }))}
            >
              <Ionicons name="refresh" size={16} color={colors.ink} />
              <AppText variant="caption" style={{ fontFamily: fonts.bold }}>Xoay</AppText>
            </Pressable>
          </View>

          {/* Horizontally scrollable list of VIP stickers and custom uploads */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stickerScroll} contentContainerStyle={styles.stickerRail}>
            <Pressable style={styles.stickerTileUpload} onPress={handleUploadCustomSticker}>
              <Ionicons name="cloud-upload" size={24} color={colors.muted} />
              <AppText variant="caption" style={{ fontSize: 9, textAlign: "center", color: colors.muted, fontFamily: fonts.bold }}>
                Tự tải
              </AppText>
            </Pressable>

            {allStickers.map((sticker) => {
              const isSelected = selectedSticker === sticker._id || selectedSticker === sticker.key;
              const source = stickerImageSource(sticker);
              return (
                <Pressable
                  key={sticker._id}
                  onPress={() => setSelectedSticker(isSelected ? undefined : sticker._id)}
                  style={[
                    styles.stickerTileSmall,
                    isSelected && styles.stickerTileSmallActive
                  ]}
                >
                  {source ? <Image source={source} style={styles.stickerImageSmall} /> : null}
                  <AppText variant="caption" numberOfLines={1} style={{ fontSize: 9, textAlign: "center", fontFamily: fonts.bold }}>
                    {sticker.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          <AppButton label="Hoàn tất" onPress={() => setStep("edit")} />
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
  onCameraPress,
  panHandlers
}: {
  images: string[];
  layout: PostLayout;
  transforms: PostImageTransform[];
  sticker?: Sticker;
  stickerPlacement: StickerPlacement;
  selectedIndex: number;
  onSelectImage?: (index: number) => void;
  onCameraPress?: () => void;
  panHandlers?: any;
}) {
  const stickerSource = stickerImageSource(sticker);

  return (
    <View style={styles.previewStage} {...(panHandlers ?? {})}>
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
                <Image source={{ uri }} style={styles.artworkImage} resizeMode="cover" />
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
    width: "100%",
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
  recipeImageTabs: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4
  },
  recipeImageTab: {
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 4
  },
  recipeImageTabActive: {
    borderColor: colors.green,
    backgroundColor: "rgba(76,175,80,0.08)"
  },
  recipeTabImage: {
    width: 56,
    height: 56,
    borderRadius: 10
  },
  recipeTabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.muted
  },
  recipeTabLabelActive: {
    color: colors.green
  },
  recipeImageHint: {
    color: colors.muted,
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginBottom: 4
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: 12
  },
  addStickerCard: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  addStickerText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14
  },
  stickerTipText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    marginVertical: 4
  },
  stickerControlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 8
  },
  stickerControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line
  },
  stickerScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginVertical: 8,
    minHeight: 90
  },
  stickerRail: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 4
  },
  stickerTileUpload: {
    width: 68,
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.muted,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  stickerTileSmall: {
    width: 68,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    gap: 2
  },
  stickerTileSmallActive: {
    borderColor: colors.black,
    backgroundColor: colors.yellow
  },
  stickerImageSmall: {
    width: 38,
    height: 38,
    resizeMode: "contain"
  }
});
