import React, { useState } from "react";
import { Alert, Image, ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

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

const interestOffsetKeys = [
  "offsetRightWide",
  "offsetLeft",
  "offsetCenterRight",
  "offsetLeftWide",
  "offsetRight"
] as const;

const eatingOffsetKeys = [
  "offsetRightWide",
  "offsetLeftWide",
  "offsetCenterRight",
  "offsetLeft",
  "offsetRight"
] as const;

function ToggleChip({
  label,
  selected,
  onPress,
  style
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected, style]}>
      <AppText style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
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

  const isInterestStep = step === "interests";
  const options = isInterestStep ? interestOptions : eatingOptions;
  const selected = isInterestStep ? interests : eatingStyles;
  const setter = isInterestStep ? setInterests : setEatingStyles;
  const offsets = isInterestStep ? interestOffsetKeys : eatingOffsetKeys;

  return (
    <ImageBackground
      source={require("../../assets/backgrounds/background1.png")}
      style={styles.background}
      resizeMode="stretch"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoBadge}>
            <Image source={require("../../assets/logo/logo.png")} style={styles.logo} resizeMode="cover" />
          </View>

          <View style={styles.header}>
            <AppText style={styles.titleText}>{isInterestStep ? "Chào bạn!!" : "Phong cách ăn"}</AppText>
            <AppText style={styles.subtitleText}>
              {isInterestStep ? "Bạn là người như thế nào?" : "Xu hướng ăn của bạn là gì?"}
            </AppText>
          </View>

          <View style={styles.grid}>
            {options.map((option, index) => (
              <ToggleChip
                key={option}
                label={option}
                selected={selected.includes(option)}
                onPress={() => toggle(option, selected, setter)}
                style={styles[offsets[index]]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            {isInterestStep ? (
              <AppButton label="Tiếp tục" onPress={() => setStep("eating")} style={styles.cta} />
            ) : (
              <AppButton label="Vào Daily Meal" onPress={finish} loading={loading} style={styles.cta} />
            )}
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 260
  },
  logoBadge: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 23
  },
  header: {
    marginTop: 48,
    marginBottom: 30,
    gap: 4
  },
  titleText: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 38,
    color: colors.black,
    letterSpacing: 0
  },
  subtitleText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink
  },
  grid: {
    gap: 18
  },
  chip: {
    minHeight: 31,
    minWidth: 136,
    maxWidth: "92%",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 0,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4
  },
  chipSelected: {
    backgroundColor: colors.green
  },
  chipText: {
    textAlign: "center",
    color: colors.black,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.semibold
  },
  chipTextSelected: {
    color: colors.white
  },
  offsetRightWide: {
    alignSelf: "flex-end",
    marginRight: 6
  },
  offsetLeft: {
    alignSelf: "flex-start",
    marginLeft: 8
  },
  offsetCenterRight: {
    alignSelf: "center",
    marginRight: -22
  },
  offsetLeftWide: {
    alignSelf: "flex-start",
    marginLeft: 0
  },
  offsetRight: {
    alignSelf: "flex-end",
    marginRight: 0
  },
  footer: {
    marginTop: 30
  },
  cta: {
    minHeight: 46,
    borderRadius: 14
  }
});
