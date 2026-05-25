import React, { useState } from "react";
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

const interestOptions = [
  "Thích chụp ảnh",
  "Thích ăn uống",
  "Thích note lại công thức nấu ăn",
  "Muốn tìm những công thức mới",
  "Khác...."
];

const eatingOptions = [
  "Ăn chay niệm phật",
  "Thâm hụt calo",
  "Chế độ keto",
  "Không theo phong cách nào",
  "Khác..."
];

function ToggleChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <AppText variant="button" style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function OnboardingScreen() {
  const { savePreferences } = useAuth();
  const [step, setStep] = useState<"interests" | "eating">("interests");
  const [interests, setInterests] = useState<string[]>([]);
  const [eatingStyles, setEatingStyles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function finish() {
    setLoading(true);
    try {
      await savePreferences(interests, eatingStyles);
    } catch (error) {
      Alert.alert("Không thể lưu onboarding", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  const options = step === "interests" ? interestOptions : eatingOptions;
  const selected = step === "interests" ? interests : eatingStyles;
  const setter = step === "interests" ? setInterests : setEatingStyles;

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppText variant="title">{step === "interests" ? "Chào bạn!!" : "Phong cách ăn"}</AppText>
          <AppText muted>
            {step === "interests"
              ? "Bạn là người như thế nào?"
              : "Xu hướng ăn của bạn là gì?"}
          </AppText>
          <View style={styles.grid}>
            {options.map((option) => (
              <ToggleChip
                key={option}
                label={option}
                selected={selected.includes(option)}
                onPress={() => toggle(option, selected, setter)}
              />
            ))}
          </View>
          <AppButton
            label={step === "interests" ? "Tiếp tục" : "Vào Daily Meal"}
            onPress={step === "interests" ? () => setStep("eating") : finish}
            loading={loading}
          />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  formContent: {
    padding: 20,
    gap: 16
  },
  grid: {
    gap: 12,
    alignItems: "center"
  },
  chip: {
    minHeight: 46,
    minWidth: 200,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  chipSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  chipText: {
    textAlign: "center"
  },
  chipTextSelected: {
    color: colors.white
  }
});
