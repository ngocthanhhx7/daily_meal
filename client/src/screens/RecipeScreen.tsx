import React from "react";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { NutritionCard } from "../components/NutritionCard";
import { colors } from "../theme/colors";

export function RecipeScreen({ route }: any) {
  const post = route.params?.post;
  const recipe = post?.recipe ?? { title: "Công thức", ingredients: [], steps: [] };

  return (
    <AppScreen>
      <AppText variant="title">{recipe.title || "Công thức món ăn"}</AppText>
      <NutritionCard nutrition={post?.nutritionSummary} />
      <View style={styles.section}>
        <AppText variant="subtitle">Nguyên liệu</AppText>
        {(recipe.ingredients?.length ? recipe.ingredients : ["Chưa có nguyên liệu"]).map((item: string) => (
          <AppText key={item}>- {item}</AppText>
        ))}
      </View>
      <View style={styles.section}>
        <AppText variant="subtitle">Cách làm</AppText>
        {(recipe.steps?.length ? recipe.steps : ["Chủ bài viết chưa ghi cách làm."]).map((item: string, index: number) => (
          <AppText key={`${item}-${index}`}>{index + 1}. {item}</AppText>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  }
});
