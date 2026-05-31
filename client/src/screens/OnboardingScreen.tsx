import React, { useState } from "react";
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, View } from "react-native";
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

function ToggleChip({
  label,
  selected,
  onPress,
  style
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: any;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected, style]}>
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
      resizeMode="stretch"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo khủng long dễ thương ở trên cùng chuẩn Figma */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Header với Typography phóng to chuẩn Figma */}
          <View style={styles.header}>
            <AppText style={styles.titleText}>{step === "interests" ? "Chào bạn!!" : "Phong cách ăn"}</AppText>
            <AppText style={styles.subtitleText}>
              {step === "interests"
                ? "Bạn là người như thế nào?"
                : "Xu hướng ăn của bạn là gì?"}
            </AppText>
          </View>

          {/* Grid Layout so le (staggered) chuẩn thiết kế */}
          <View style={styles.grid}>
            {options.map((option, index) => {
              let staggeredStyle = {};
              
              if (step === "interests") {
                if (index === 0) {
                  // "Thích chụp ảnh": lệch phải
                  staggeredStyle = { alignSelf: "flex-end", marginRight: 24 };
                } else if (index === 1) {
                  // "Thích ăn uống": lệch trái
                  staggeredStyle = { alignSelf: "flex-start", marginLeft: 16 };
                } else if (index === 2) {
                  // "Thích note lại công thức nấu ăn": lệch phải/giữa
                  staggeredStyle = { alignSelf: "center", marginRight: -24 };
                } else if (index === 3) {
                  // "Muốn tìm những công thức mới": lệch trái
                  staggeredStyle = { alignSelf: "flex-start", marginLeft: 24 };
                } else if (index === 4) {
                  // "Khác....": lệch phải sâu
                  staggeredStyle = { alignSelf: "flex-end", marginRight: 48 };
                }
              } else {
                if (index === 0) {
                  // "Ăn chay niệm phật": lệch phải
                  staggeredStyle = { alignSelf: "flex-end", marginRight: 32 };
                } else if (index === 1) {
                  // "Thâm hụt calo": lệch trái
                  staggeredStyle = { alignSelf: "flex-start", marginLeft: 24 };
                } else if (index === 2) {
                  // "Chế độ keto": lệch phải nhẹ/giữa
                  staggeredStyle = { alignSelf: "center", marginRight: -16 };
                } else if (index === 3) {
                  // "Không theo phong cách nào": lệch trái
                  staggeredStyle = { alignSelf: "flex-start", marginLeft: 12 };
                } else if (index === 4) {
                  // "Khác...": lệch phải sâu
                  staggeredStyle = { alignSelf: "flex-end", marginRight: 40 };
                }
              }

              return (
                <ToggleChip
                  key={option}
                  label={option}
                  selected={selected.includes(option)}
                  onPress={() => toggle(option, selected, setter)}
                  style={staggeredStyle}
                />
              );
            })}
          </View>

          <View style={styles.buttonContainer}>
            <AppButton
              label={step === "interests" ? "Tiếp tục" : "Vào Daily Meal"}
              onPress={step === "interests" ? () => setStep("eating") : finish}
              loading={loading}
            />
          </View>
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
    padding: 24,
    paddingBottom: 120, // Tạo khoảng trống lớn ở dưới để lộ hình vẽ đĩa ăn cực đẹp ở hình nền
    gap: 24
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32
  },
  header: {
    marginTop: 20,
    marginBottom: 8,
    gap: 6
  },
  titleText: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: fonts.bold,
    color: colors.ink
  },
  subtitleText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.medium,
    color: colors.muted
  },
  grid: {
    gap: 16,
    width: "100%"
  },
  chip: {
    minHeight: 48,
    minWidth: 200,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 0, // Không viền chuẩn Figma
    
    // Hiệu ứng đổ bóng sticker nổi 3D cực kỳ xịn sò
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  chipSelected: {
    backgroundColor: colors.black,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5
  },
  chipText: {
    textAlign: "center",
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.semibold
  },
  chipTextSelected: {
    color: colors.white
  },
  buttonContainer: {
    marginTop: 16
  }
});
