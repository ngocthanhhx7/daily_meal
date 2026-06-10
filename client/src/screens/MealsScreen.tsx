import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { NutritionCard } from "../components/NutritionCard";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { demoMeals } from "../data/sample";
import { analytics } from "../services/analytics";
import { colors } from "../theme/colors";
import type { Meal } from "../types/api";
import { getPendingPickedImageUri, pickSingleImage } from "../utils/imagePicker";

export function MealsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [meals, setMeals] = useState<Meal[]>(demoMeals);
  const [selectedUri, setSelectedUri] = useState<string | undefined>();
  const [aiHints, setAiHints] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .meals(token)
      .then((result) => setMeals(result.meals.length ? result.meals : demoMeals))
      .catch(() => undefined);
  }, [token]);

  async function pick(camera = false) {
    analytics.track("meal_analysis_photo_picker_opened", {
      screen: "Meals",
      properties: { source: camera ? "camera" : "library" }
    });
    const uri = await pickSingleImage(camera ? "camera" : "library");

    if (uri) {
      analytics.track("meal_analysis_photo_selected", {
        screen: "Meals",
        properties: { source: camera ? "camera" : "library" }
      });
      setSelectedUri(uri);
    }
  }

  useEffect(() => {
    let mounted = true;

    getPendingPickedImageUri()
      .then((uri) => {
        if (mounted && uri) {
          setSelectedUri(uri);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  async function analyze() {
    if (!token || !selectedUri) {
      analytics.track("meal_analysis_blocked", {
        screen: "Meals",
        properties: { reason: !token ? "missing_token" : "missing_image" }
      });
      Alert.alert("Chưa có ảnh", "Chụp hoặc chọn ảnh món ăn trước.");
      return;
    }
    setLoading(true);
    const startedAt = Date.now();
    analytics.track("meal_analysis_started", {
      screen: "Meals",
      properties: { hasHints: Boolean(aiHints.trim()) }
    });
    try {
      const upload = await api.uploadImage(token, selectedUri, "meal");
      const ingredientsText = aiHints.trim();
      const result = await api.analyzeMeal(
        token,
        upload.upload._id,
        ingredientsText ? { ingredientsText } : undefined
      );
      setMeals((current) => [result.meal, ...current]);
      setSelectedUri(undefined);
      setAiHints("");
      analytics.track("meal_analysis_succeeded", {
        screen: "Meals",
        entityType: "meal",
        entityId: result.meal._id,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      analytics.track("meal_analysis_failed", {
        screen: "Meals",
        durationMs: Date.now() - startedAt,
        properties: {
          message: error instanceof Error ? error.message : "unknown"
        }
      });
      Alert.alert("Không thể tính calo", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      {/* Header */}
      <View style={styles.headerBlock}>
        <AppText variant="title">Phân tích Calo</AppText>
        <AppText muted>Chụp món ăn để AI ước tính calo và macro.</AppText>
      </View>

      {/* Analyze panel */}
      <View style={styles.panel}>
        {selectedUri ? (
          <View>
            <Image source={{ uri: selectedUri }} style={styles.preview} resizeMode="cover" />
            <Pressable style={styles.clearImage} onPress={() => setSelectedUri(undefined)}>
              <Ionicons name="close-circle" size={24} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Ionicons name="camera-outline" size={36} color={colors.muted} />
            <AppText variant="caption" muted>
              Chưa chọn ảnh
            </AppText>
          </View>
        )}

        <View style={styles.pickRow}>
          <AppButton
            label="Chụp ảnh"
            variant="secondary"
            onPress={() => pick(true)}
            style={styles.pickBtn}
          />
          <AppButton
            label="Thư viện"
            variant="ghost"
            onPress={() => pick(false)}
            style={styles.pickBtn}
          />
        </View>

        <TextField
          label="Thành phần và định lượng cho AI"
          value={aiHints}
          onChangeText={setAiHints}
          placeholder={"Ví dụ: Cơm trắng 120g\nThịt heo 100g\nNước cam 200ml"}
          multiline
          style={styles.hintInput}
        />

        <AppButton
          label="Phân tích món ăn"
          onPress={analyze}
          loading={loading}
          disabled={!selectedUri}
        />
      </View>

      {/* History */}
      <AppText variant="subtitle">Lịch sử</AppText>

      {meals.length ? (
        meals.map((meal) => (
          <Pressable
            key={meal._id}
            style={styles.mealCard}
            onPress={() => {
              analytics.track("meal_to_create_post_click", {
                screen: "Meals",
                entityType: "meal",
                entityId: meal._id
              });
              navigation.navigate("Create", { meal });
            }}
          >
            <View style={styles.mealHeader}>
              {/* numberOfLines ngăn tên dài vỡ layout */}
              <AppText variant="button" style={styles.mealName} numberOfLines={2}>
                {meal.result.items[0]?.name ?? "Món ăn"}
              </AppText>
              <AppText variant="caption" muted style={styles.mealDate}>
                {new Date(meal.createdAt).toLocaleDateString("vi-VN")}
              </AppText>
            </View>
            <NutritionCard nutrition={meal.result.total} />
            {meal.result.warnings.map((warning) => (
              <View key={warning} style={styles.warningRow}>
                <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
                <AppText variant="caption" muted style={styles.warningText}>
                  {warning}
                </AppText>
              </View>
            ))}
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="Chưa có lịch sử"
          message="Phân tích bữa ăn đầu tiên để lưu vào nhật ký."
          icon="nutrition-outline"
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 4
  },
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.canvasStrong
  },
  clearImage: {
    position: "absolute",
    top: 8,
    right: 8
  },
  emptyPreview: {
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.canvas
  },
  pickRow: {
    flexDirection: "row",
    gap: 10
  },
  pickBtn: {
    flex: 1
  },
  hintInput: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: 12
  },
  mealCard: {
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  mealName: {
    // flex:1 + minWidth:0 để tên dài không đẩy date ra ngoài
    flex: 1,
    minWidth: 0
  },
  mealDate: {
    flexShrink: 0
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6
  },
  warningText: {
    flex: 1
  }
});
