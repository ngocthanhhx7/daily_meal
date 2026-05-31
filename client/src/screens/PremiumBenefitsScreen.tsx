import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View, ScrollView } from "react-native";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { AppButton } from "../components/AppButton";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const plans = [
  { id: "monthly", name: "Gói Tháng", price: "29.000 đ", period: "/ tháng", discount: null },
  { id: "yearly", name: "Gói Năm (Tiết kiệm 40%)", price: "199.000 đ", period: "/ năm", discount: "👑 Bán chạy nhất" }
];

export function PremiumBenefitsScreen({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);

  const isPremium = user?.isPremium || false;

  async function handleUpgrade() {
    if (isPremium) {
      Alert.alert("Daily Premium", "Bạn đã sở hữu trọn vẹn đặc quyền Premium kiêu hãnh rồi!");
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      try {
        await updateUser({ isPremium: true });
        setLoading(false);
        Alert.alert(
          "Nâng cấp thành công! 🎉",
          "Cảm ơn bạn đã nâng cấp Daily Premium. Trải nghiệm ẩm thực đẳng cấp chính thức bắt đầu!",
          [
            {
              text: "Khám phá ngay",
              onPress: () => navigation.goBack()
            }
          ]
        );
      } catch (err) {
        setLoading(false);
        Alert.alert("Lỗi", "Không thể nâng cấp lúc này, vui lòng thử lại sau.");
      }
    }, 1500);
  }

  return (
    <AppScreen scroll={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Quyền lợi Premium</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <View style={styles.premiumBanner}>
          <AppText style={styles.bannerEmoji}>👑</AppText>
          <AppText style={styles.bannerTitle}>Daily Premium</AppText>
          <AppText style={styles.bannerSubtitle}>
            Nâng tầm phong cách nấu ăn và chia sẻ của bạn lên đỉnh cao!
          </AppText>
        </View>

        {/* Benefits list */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="sparkles" size={18} color={colors.yellow} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Mở khóa Nhãn dán 3D Độc quyền</AppText>
              <AppText style={styles.benefitDesc}>Bộ sticker khủng long lấp lánh và biểu cảm đặc biệt chỉ dành cho Premium.</AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="nutrition" size={18} color={colors.greenDark} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Phân tích Dinh dưỡng AI Nâng cao</AppText>
              <AppText style={styles.benefitDesc}>Nhận định chính xác lượng calo, protein, carbs và gợi ý sức khoẻ cực chuẩn.</AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="people" size={18} color={colors.greenDark} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Nhóm Gia Đình Chia Sẻ</AppText>
              <AppText style={styles.benefitDesc}>Dùng chung quyền lợi Premium với tối đa 5 thành viên mà không phát sinh thêm phí.</AppText>
            </View>
          </View>
        </View>

        {/* Plan Selector */}
        {!isPremium ? (
          <View style={styles.plansSection}>
            <AppText variant="caption" muted style={styles.sectionLabel}>
              Chọn gói đăng ký phù hợp
            </AppText>

            {plans.map((plan) => {
              const active = selectedPlan === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => setSelectedPlan(plan.id)}
                >
                  <View style={styles.planHeader}>
                    <AppText style={[styles.planName, active && styles.planTextActive]}>
                      {plan.name}
                    </AppText>
                    {plan.discount && <AppText style={styles.planDiscount}>{plan.discount}</AppText>}
                  </View>
                  <View style={styles.planPriceWrap}>
                    <AppText style={[styles.planPrice, active && styles.planTextActive]}>
                      {plan.price}
                    </AppText>
                    <AppText style={[styles.planPeriod, active && styles.planTextActive]} muted>
                      {plan.period}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}

            <AppButton
              label="Nâng cấp Premium Ngay"
              onPress={handleUpgrade}
              loading={loading}
            />
          </View>
        ) : (
          <View style={styles.alreadyPremium}>
            <AppText style={styles.alreadyPremiumText}>
              👑 Bạn đã sở hữu Daily Premium kiêu hãnh!
            </AppText>
            <AppText style={styles.alreadyPremiumSub} muted>
              Toàn bộ tính năng cao cấp nhất đã được kích hoạt trên tài khoản của bạn.
            </AppText>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 40
  },
  premiumBanner: {
    backgroundColor: colors.black,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    gap: 6
  },
  bannerEmoji: {
    fontSize: 32
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.white
  },
  bannerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.canvasStrong,
    textAlign: "center"
  },
  benefitsList: {
    gap: 12
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14
  },
  benefitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${colors.green}15`,
    alignItems: "center",
    justifyContent: "center"
  },
  benefitInfo: {
    flex: 1,
    gap: 2
  },
  benefitTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink
  },
  benefitDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted
  },
  plansSection: {
    gap: 12,
    marginTop: 6
  },
  sectionLabel: {
    textTransform: "none",
    fontSize: 13
  },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  planCardActive: {
    borderColor: colors.yellow,
    backgroundColor: `${colors.yellow}05`
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  planName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink
  },
  planTextActive: {
    color: colors.ink
  },
  planDiscount: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.greenDark,
    backgroundColor: `${colors.green}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  planPriceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4
  },
  planPrice: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.ink
  },
  planPeriod: {
    fontSize: 13
  },
  alreadyPremium: {
    backgroundColor: `${colors.yellow}10`,
    borderWidth: 1.5,
    borderColor: colors.yellow,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 6,
    marginTop: 10
  },
  alreadyPremiumText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink
  },
  alreadyPremiumSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: colors.muted
  }
});
