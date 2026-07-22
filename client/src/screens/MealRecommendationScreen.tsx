import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getCurrentForegroundLocation, type ForegroundLocation } from "../services/location";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type {
  MealPeriod,
  MealRecommendation,
  MealRecommendationProfile,
  NearbyRestaurant,
  RecommendationBudget,
  RecommendationDiet,
  RecommendationGoal,
  RecommendationMode,
  TodayRecommendations
} from "../types/api";

const DEFAULT_PROFILE: MealRecommendationProfile = {
  diet: "flexible",
  goals: ["balanced"],
  allergens: [],
  dislikes: [],
  preferredCuisines: [],
  budget: "any",
  maxCookingMinutes: 45,
  spiceLevel: "medium"
};

const DIETS: Array<{ value: RecommendationDiet; label: string }> = [
  { value: "flexible", label: "Linh hoạt" },
  { value: "vegetarian", label: "Chay" },
  { value: "vegan", label: "Thuần chay" },
  { value: "keto", label: "Keto" }
];

const GOALS: Array<{ value: RecommendationGoal; label: string }> = [
  { value: "balanced", label: "Cân bằng" },
  { value: "low_calorie", label: "Ít calo" },
  { value: "high_protein", label: "Giàu đạm" }
];

const BUDGETS: Array<{ value: RecommendationBudget; label: string }> = [
  { value: "any", label: "Mọi mức" },
  { value: "low", label: "Tiết kiệm" },
  { value: "medium", label: "Vừa phải" }
];

const MODES: Array<{ value: RecommendationMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "cook", label: "Tự nấu", icon: "restaurant-outline" },
  { value: "eat_out", label: "Ăn ngoài", icon: "storefront-outline" },
  { value: "any", label: "Cả hai", icon: "sparkles-outline" }
];

function mealPeriodNow(): MealPeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 23) return "dinner";
  return "late_night";
}

function periodLabel(period: MealPeriod) {
  return {
    breakfast: "bữa sáng",
    lunch: "bữa trưa",
    dinner: "bữa tối",
    late_night: "bữa khuya"
  }[period];
}

function splitTerms(value: string) {
  return value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

function imageUri(url?: string) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${api.baseUrl}${url}`;
}

export function MealRecommendationScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<MealRecommendationProfile>(user?.mealRecommendationProfile ?? DEFAULT_PROFILE);
  const [allergensText, setAllergensText] = useState(profile.allergens.join(", "));
  const [dislikesText, setDislikesText] = useState(profile.dislikes.join(", "));
  const [mode, setMode] = useState<RecommendationMode>("any");
  const [location, setLocation] = useState<ForegroundLocation | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [locating, setLocating] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [result, setResult] = useState<TodayRecommendations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());
  const [expandedRecipeKeys, setExpandedRecipeKeys] = useState<Set<string>>(new Set());

  const normalizedProfile = useMemo<MealRecommendationProfile>(() => ({
    ...profile,
    allergens: splitTerms(allergensText),
    dislikes: splitTerms(dislikesText),
    maxCookingMinutes: Math.max(5, Math.min(180, Number(profile.maxCookingMinutes) || DEFAULT_PROFILE.maxCookingMinutes))
  }), [allergensText, dislikesText, profile]);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoadingProfile(false);
      return;
    }

    api.recommendationProfile(token)
      .then(({ profile: savedProfile }) => {
        if (!active) return;
        setProfile(savedProfile);
        setAllergensText(savedProfile.allergens.join(", "));
        setDislikesText(savedProfile.dislikes.join(", "));
      })
      .catch(() => {
        // A recommendation profile is optional until the user saves it.
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    try {
      const currentLocation = await getCurrentForegroundLocation();
      setLocation(currentLocation);
      setError(null);
    } catch (locationError) {
      const message = locationError instanceof Error ? locationError.message : "Không thể lấy vị trí hiện tại.";
      setError(message);
      Alert.alert("Chưa dùng được vị trí", message);
    } finally {
      setLocating(false);
    }
  }, []);

  const findRecommendations = useCallback(async () => {
    if (!token) return;
    setLoadingRecommendations(true);
    setError(null);
    try {
      await api.saveRecommendationProfile(token, normalizedProfile);
      const recommendations = await api.todayRecommendations(token, {
        mode,
        mealPeriod: mealPeriodNow(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        limit: 6
      });
      setResult(recommendations);
      setDismissedKeys(new Set());
      setExpandedRecipeKeys(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tải gợi ý ngay bây giờ.");
    } finally {
      setLoadingRecommendations(false);
    }
  }, [location?.latitude, location?.longitude, mode, normalizedProfile, token]);

  const sendFeedback = useCallback((targetKey: string, targetType: "meal" | "restaurant", action: "liked" | "dismissed" | "opened_recipe" | "opened_restaurant") => {
    if (!token) return;
    api.recommendationFeedback(token, { targetKey, targetType, action }).catch(() => {
      // Feedback is non-blocking: a recommendation should remain usable offline.
    });
  }, [token]);

  const toggleGoal = (goal: RecommendationGoal) => {
    setProfile((current) => {
      const nextGoals = current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : [...current.goals, goal];
      return { ...current, goals: nextGoals.length ? nextGoals : ["balanced"] };
    });
  };

  const toggleLike = (meal: MealRecommendation) => {
    setLikedKeys((current) => {
      const next = new Set(current);
      if (next.has(meal.key)) next.delete(meal.key);
      else {
        next.add(meal.key);
        sendFeedback(meal.key, "meal", "liked");
      }
      return next;
    });
  };

  const dismissMeal = (meal: MealRecommendation) => {
    setDismissedKeys((current) => new Set(current).add(meal.key));
    sendFeedback(meal.key, "meal", "dismissed");
  };

  const toggleRecipe = (meal: MealRecommendation) => {
    setExpandedRecipeKeys((current) => {
      const next = new Set(current);
      if (next.has(meal.key)) {
        next.delete(meal.key);
      } else {
        next.add(meal.key);
        sendFeedback(meal.key, "meal", "opened_recipe");
      }
      return next;
    });
  };

  const openRestaurant = async (restaurant: NearbyRestaurant) => {
    const mapUrl = restaurant.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`;
    try {
      const supported = await Linking.canOpenURL(mapUrl);
      if (!supported) throw new Error("Không mở được bản đồ trên thiết bị này.");
      await Linking.openURL(mapUrl);
      sendFeedback(restaurant.key, "restaurant", "opened_restaurant");
    } catch (mapError) {
      Alert.alert("Không thể mở bản đồ", mapError instanceof Error ? mapError.message : "Vui lòng thử lại sau.");
    }
  };

  const visibleMeals = result?.meals.filter((meal) => !dismissedKeys.has(meal.key)) ?? [];

  return (
    <AppScreen scroll keyboard style={styles.content} scrollProps={{ contentContainerStyle: styles.content }}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title" style={styles.title}>Hôm nay ăn gì?</AppText>
          <AppText muted>Gợi ý theo khẩu vị, thời gian và hoàn cảnh của bạn.</AppText>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="options-outline" size={20} color={colors.greenDark} />
          <AppText variant="subtitle">Bạn đang muốn</AppText>
        </View>
        <View style={styles.segmentedRow}>
          {MODES.map((item) => {
            const selected = mode === item.value;
            return (
              <Pressable key={item.value} style={[styles.modeOption, selected && styles.optionSelected]} onPress={() => setMode(item.value)}>
                <Ionicons name={item.icon} size={18} color={selected ? colors.greenDark : colors.muted} />
                <AppText variant="caption" style={[styles.optionText, selected && styles.optionTextSelected]}>{item.label}</AppText>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.locationButton, location && styles.locationButtonReady]} onPress={requestLocation} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={colors.greenDark} /> : <Ionicons name={location ? "location" : "location-outline"} size={19} color={colors.greenDark} />}
          <View style={styles.locationCopy}>
            <AppText variant="button" style={styles.locationTitle}>{location ? "Đã dùng vị trí hiện tại" : "Dùng vị trí hiện tại"}</AppText>
            <AppText variant="caption" muted>{location ? "Để tìm quán phù hợp gần bạn" : "Chỉ dùng khi bạn bấm nút này"}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={21} color={colors.greenDark} />
          <AppText variant="subtitle">Hồ sơ ăn uống</AppText>
        </View>

        <AppText variant="label" style={styles.fieldLabel}>Chế độ ăn</AppText>
        <View style={styles.chipRow}>
          {DIETS.map((item) => <ChoiceChip key={item.value} label={item.label} selected={profile.diet === item.value} onPress={() => setProfile((current) => ({ ...current, diet: item.value }))} />)}
        </View>

        <AppText variant="label" style={styles.fieldLabel}>Mục tiêu</AppText>
        <View style={styles.chipRow}>
          {GOALS.map((item) => <ChoiceChip key={item.value} label={item.label} selected={profile.goals.includes(item.value)} onPress={() => toggleGoal(item.value)} />)}
        </View>

        <AppText variant="label" style={styles.fieldLabel}>Ngân sách</AppText>
        <View style={styles.chipRow}>
          {BUDGETS.map((item) => <ChoiceChip key={item.value} label={item.label} selected={profile.budget === item.value} onPress={() => setProfile((current) => ({ ...current, budget: item.value }))} />)}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <AppText variant="label" style={styles.fieldLabel}>Dị ứng</AppText>
            <TextInput value={allergensText} onChangeText={setAllergensText} placeholder="Ví dụ: đậu phộng" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
          <View style={styles.inputGroup}>
            <AppText variant="label" style={styles.fieldLabel}>Không thích</AppText>
            <TextInput value={dislikesText} onChangeText={setDislikesText} placeholder="Ví dụ: hành" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
        </View>
        <AppText variant="caption" muted>Ngăn cách nhiều mục bằng dấu phẩy.</AppText>

        <AppText variant="label" style={styles.fieldLabel}>Thời gian nấu tối đa</AppText>
        <View style={styles.timeRow}>
          {[20, 45, 75].map((minutes) => <ChoiceChip key={minutes} label={`${minutes} phút`} selected={profile.maxCookingMinutes === minutes} onPress={() => setProfile((current) => ({ ...current, maxCookingMinutes: minutes }))} />)}
          <TextInput
            value={String(profile.maxCookingMinutes)}
            onChangeText={(value) => setProfile((current) => ({ ...current, maxCookingMinutes: Number(value.replace(/[^0-9]/g, "")) || 0 }))}
            keyboardType="number-pad"
            style={styles.timeInput}
            maxLength={3}
            accessibilityLabel="Số phút nấu tối đa"
          />
          <AppText variant="caption" muted>phút</AppText>
        </View>
      </View>

      {error ? <View style={styles.errorCard}><Ionicons name="information-circle-outline" size={19} color={colors.red} /><AppText style={styles.errorText}>{error}</AppText></View> : null}

      <Pressable style={[styles.primaryButton, loadingRecommendations && styles.buttonDisabled]} onPress={findRecommendations} disabled={loadingRecommendations || loadingProfile}>
        {loadingRecommendations || loadingProfile ? <ActivityIndicator color={colors.white} /> : <Ionicons name="sparkles" size={20} color={colors.white} />}
        <AppText variant="button" style={styles.primaryButtonText}>{loadingRecommendations ? "Đang chọn món cho bạn..." : `Xem gợi ý ${periodLabel(mealPeriodNow())}`}</AppText>
      </Pressable>

      {result ? (
        <View style={styles.results}>
          <View style={styles.contextCard}>
            <Ionicons name={result.context.weather?.isRainy ? "rainy-outline" : result.context.weather?.isHot ? "sunny-outline" : "partly-sunny-outline"} size={24} color={colors.greenDark} />
            <View style={styles.contextCopy}>
              <AppText variant="button">{result.context.weather ? `${result.context.weather.condition}${typeof result.context.weather.temperature === "number" ? ` · ${Math.round(result.context.weather.temperature)}°C` : ""}` : "Gợi ý theo thời điểm trong ngày"}</AppText>
              <AppText variant="caption" muted>{result.context.hasLocation ? "Đã kết hợp vị trí của bạn." : "Chưa dùng vị trí — bạn có thể thêm để tìm quán gần đây."}</AppText>
            </View>
          </View>

          {Object.values(result.degraded).some(Boolean) ? <AppText variant="caption" style={styles.degradedText}>Một phần dữ liệu đang tạm thời hạn chế, nên kết quả có thể ít cá nhân hóa hơn.</AppText> : null}

          {visibleMeals.length ? <AppText variant="subtitle">Món hợp với bạn</AppText> : null}
          {visibleMeals.map((meal) => (
            <MealCard key={meal.key} meal={meal} liked={likedKeys.has(meal.key)} recipeExpanded={expandedRecipeKeys.has(meal.key)} onLike={() => toggleLike(meal)} onDismiss={() => dismissMeal(meal)} onToggleRecipe={() => toggleRecipe(meal)} />
          ))}
          {!visibleMeals.length && result.meals.length ? <AppText muted style={styles.emptyText}>Bạn đã ẩn hết món hiện tại. Hãy thử tìm lại với lựa chọn khác.</AppText> : null}

          {result.nearbyRestaurants.length ? <AppText variant="subtitle">Quán gần bạn</AppText> : null}
          {result.nearbyRestaurants.map((restaurant) => <RestaurantCard key={restaurant.key} restaurant={restaurant} onOpen={() => openRestaurant(restaurant)} />)}
          {!result.meals.length && !result.nearbyRestaurants.length ? <View style={styles.emptyCard}><Ionicons name="restaurant-outline" size={34} color={colors.muted} /><AppText muted>Chưa tìm được lựa chọn phù hợp. Hãy thử nới rộng hồ sơ hoặc chọn “Cả hai”.</AppText></View> : null}
          {result.attribution?.weather || result.attribution?.places ? <AppText variant="caption" muted style={styles.attribution}>{[result.attribution.weather, result.attribution.places].filter(Boolean).join(" · ")}</AppText> : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress}><AppText variant="caption" style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</AppText></Pressable>;
}

function MealCard({ meal, liked, recipeExpanded, onLike, onDismiss, onToggleRecipe }: { meal: MealRecommendation; liked: boolean; recipeExpanded: boolean; onLike: () => void; onDismiss: () => void; onToggleRecipe: () => void }) {
  const source = imageUri(meal.imageUrl);
  return (
    <View style={styles.mealCard}>
      {source ? <Image source={{ uri: source }} style={styles.mealImage} resizeMode="cover" /> : <View style={styles.mealImagePlaceholder}><Ionicons name="restaurant-outline" size={34} color={colors.greenDark} /></View>}
      <View style={styles.mealBody}>
        <View style={styles.mealHeading}>
          <View style={styles.mealCopy}><AppText variant="subtitle">{meal.name}</AppText><AppText variant="caption" muted numberOfLines={2}>{meal.description}</AppText></View>
          <Pressable style={styles.dismissButton} onPress={onDismiss} accessibilityLabel={`Ẩn gợi ý ${meal.name}`}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
        </View>
        <View style={styles.metaRow}>
          {typeof meal.calories === "number" ? <Meta icon="flame-outline" text={`${Math.round(meal.calories)} kcal`} /> : null}
          <Meta icon="time-outline" text={`${meal.cookingMinutes} phút`} />
          {meal.protein ? <Meta icon="fitness-outline" text={`${Math.round(meal.protein)}g đạm`} /> : null}
        </View>
        {meal.reasons.length ? <View style={styles.reasonPill}><Ionicons name="checkmark-circle" size={15} color={colors.greenDark} /><AppText variant="caption" style={styles.reasonText}>{meal.reasons[0]}</AppText></View> : null}
        {meal.allergyNotice ? <AppText variant="caption" style={styles.allergyText}>{meal.allergyNotice}</AppText> : null}
        <View style={styles.mealActions}>
          <Pressable style={[styles.iconAction, liked && styles.iconActionLiked]} onPress={onLike}><Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? colors.red : colors.ink} /><AppText variant="caption">Hợp gu</AppText></Pressable>
          {meal.ingredients.length || meal.steps.length ? <Pressable style={styles.recipeAction} onPress={onToggleRecipe}><AppText variant="button" style={styles.recipeActionText}>{recipeExpanded ? "Thu gọn" : "Xem công thức"}</AppText><Ionicons name={recipeExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.white} /></Pressable> : null}
        </View>
        {recipeExpanded ? <View style={styles.recipeDetails}>
          {meal.ingredients.length ? <View style={styles.recipeSection}><AppText variant="label" style={styles.recipeHeading}>Nguyên liệu</AppText>{meal.ingredients.map((ingredient, index) => <View key={`${meal.key}:ingredient:${index}`} style={styles.recipeLine}><View style={styles.recipeDot} /><AppText variant="caption" style={styles.recipeLineText}>{ingredient}</AppText></View>)}</View> : null}
          {meal.steps.length ? <View style={styles.recipeSection}><AppText variant="label" style={styles.recipeHeading}>Cách làm</AppText>{meal.steps.map((step, index) => <View key={`${meal.key}:step:${index}`} style={styles.recipeLine}><View style={styles.stepNumber}><AppText variant="caption" style={styles.stepNumberText}>{index + 1}</AppText></View><AppText variant="caption" style={styles.recipeLineText}>{step}</AppText></View>)}</View> : null}
        </View> : null}
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.meta}><Ionicons name={icon} size={14} color={colors.muted} /><AppText variant="caption" muted>{text}</AppText></View>;
}

function RestaurantCard({ restaurant, onOpen }: { restaurant: NearbyRestaurant; onOpen: () => void }) {
  const distance = typeof restaurant.distanceMeters === "number" ? restaurant.distanceMeters >= 1000 ? `${(restaurant.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(restaurant.distanceMeters)} m` : null;
  return <View style={styles.restaurantCard}><View style={styles.restaurantIcon}><Ionicons name="storefront-outline" size={23} color={colors.greenDark} /></View><View style={styles.restaurantCopy}><AppText variant="subtitle">{restaurant.name}</AppText><AppText variant="caption" muted numberOfLines={2}>{restaurant.address}</AppText><AppText variant="caption" style={styles.matchReason}>{restaurant.matchReason}{distance ? ` · ${distance}` : ""}</AppText></View><Pressable style={styles.mapButton} onPress={onOpen}><Ionicons name="map-outline" size={20} color={colors.white} /></Pressable></View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 42, gap: 14, width: "100%", maxWidth: 680, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  headerCopy: { flex: 1, gap: 2 }, title: { color: colors.black },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 15, gap: 11 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, fieldLabel: { color: colors.muted, marginTop: 3 },
  segmentedRow: { flexDirection: "row", gap: 7 }, modeOption: { flex: 1, minHeight: 64, borderRadius: 14, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 5, borderWidth: 1, borderColor: colors.line }, optionSelected: { backgroundColor: "#E7F0E4", borderColor: colors.green }, optionText: { color: colors.muted, textAlign: "center" }, optionTextSelected: { color: colors.greenDark, fontFamily: fonts.semibold },
  locationButton: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: colors.canvas, padding: 12, borderWidth: 1, borderColor: colors.line }, locationButtonReady: { backgroundColor: "#E7F0E4", borderColor: colors.green }, locationCopy: { flex: 1, gap: 1 }, locationTitle: { color: colors.greenDark },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, choiceChip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, choiceChipSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark }, choiceText: { color: colors.ink }, choiceTextSelected: { color: colors.white, fontFamily: fonts.semibold },
  inputRow: { flexDirection: "row", gap: 9 }, inputGroup: { flex: 1, minWidth: 0, gap: 5 }, input: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, paddingHorizontal: 10, color: colors.ink, fontFamily: fonts.regular, fontSize: 13 },
  timeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 }, timeInput: { width: 45, height: 35, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, textAlign: "center", fontFamily: fonts.medium, color: colors.ink },
  errorCard: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#FFF0EF", borderWidth: 1, borderColor: "#F4C1BD" }, errorText: { flex: 1, color: colors.red, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, backgroundColor: colors.greenDark, paddingHorizontal: 16 }, buttonDisabled: { opacity: 0.7 }, primaryButtonText: { color: colors.white, textAlign: "center" },
  results: { gap: 12, marginTop: 3 }, contextCard: { flexDirection: "row", gap: 11, borderRadius: 16, backgroundColor: "#E7F0E4", padding: 13, borderWidth: 1, borderColor: "#C5D8C1" }, contextCopy: { flex: 1, gap: 2 }, degradedText: { color: colors.greenDark, backgroundColor: "#FFF5D8", padding: 10, borderRadius: 11 },
  mealCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, mealImage: { width: "100%", height: 155, backgroundColor: colors.canvasStrong }, mealImagePlaceholder: { height: 118, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F0E4" }, mealBody: { padding: 14, gap: 9 }, mealHeading: { flexDirection: "row", gap: 8, alignItems: "flex-start" }, mealCopy: { flex: 1, gap: 2 }, dismissButton: { width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }, metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, meta: { flexDirection: "row", alignItems: "center", gap: 3 }, reasonPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#E7F0E4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, reasonText: { color: colors.greenDark }, allergyText: { color: "#A05D00", backgroundColor: "#FFF5D8", borderRadius: 9, padding: 7 }, mealActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 }, iconAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 36, borderRadius: 10, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line }, iconActionLiked: { backgroundColor: "#FFF0EF", borderColor: "#F4C1BD" }, recipeAction: { flex: 1, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, backgroundColor: colors.greenDark, paddingHorizontal: 10 }, recipeActionText: { color: colors.white, fontSize: 13 },
  recipeDetails: { gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }, recipeSection: { gap: 7 }, recipeHeading: { color: colors.greenDark }, recipeLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, recipeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: colors.green }, recipeLineText: { flex: 1, color: colors.ink, lineHeight: 19 }, stepNumber: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F0E4" }, stepNumberText: { color: colors.greenDark, fontFamily: fonts.semibold },
  restaurantCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: 17, padding: 12, borderWidth: 1, borderColor: colors.line }, restaurantIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#E7F0E4", alignItems: "center", justifyContent: "center" }, restaurantCopy: { flex: 1, gap: 2 }, matchReason: { color: colors.greenDark }, mapButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.greenDark, alignItems: "center", justifyContent: "center" },
  emptyCard: { alignItems: "center", gap: 9, padding: 24, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.line }, emptyText: { textAlign: "center" }, attribution: { textAlign: "center", marginTop: 2 }
});
