import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import type { NutritionSummary } from "../types/api";
import { AppText } from "./AppText";

type NutritionCardProps = {
  nutrition?: NutritionSummary;
};

const NUTRIENTS = [
  { key: "calories" as const, label: "Calo", unit: "kcal" },
  { key: "protein" as const, label: "Protein", unit: "g" },
  { key: "carbs" as const, label: "Carbs", unit: "g" },
  { key: "fat" as const, label: "Fat", unit: "g" }
];

export function NutritionCard({ nutrition }: NutritionCardProps) {
  if (!nutrition) {
    return null;
  }

  return (
    <View style={styles.card}>
      {NUTRIENTS.map(({ key, label, unit }) => (
        <View key={key} style={styles.item}>
          <AppText variant="caption" muted>
            {label}
          </AppText>
          <AppText variant="subtitle" numberOfLines={1}>
            {Math.round(nutrition[key])} {unit}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    // Dùng gap thay vì width:"47%" để tránh lỗi tràn trên màn nhỏ
    gap: 0,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  item: {
    // flex:1 thay vì width:"47%" — không bao giờ tràn
    flex: 1,
    gap: 3,
    alignItems: "center",
    paddingVertical: 4
  }
});
