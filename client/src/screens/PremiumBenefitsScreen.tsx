import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { PremiumPlan } from "../types/api";

type PremiumPlanId = PremiumPlan["id"];

const plans: Array<{
  id: PremiumPlanId;
  name: string;
  price: string;
  period: string;
  discount: string | null;
}> = [
  { id: "premium_month", name: "Gói tháng", price: "39.000 đ", period: "/ tháng", discount: null },
  { id: "premium_quarter", name: "Gói 3 tháng", price: "99.000 đ", period: "/ 3 tháng", discount: "Phổ biến" },
  { id: "premium_half", name: "Gói 6 tháng", price: "199.000 đ", period: "/ 6 tháng", discount: "Tiết kiệm nhất" }
];

export function PremiumBenefitsScreen({ navigation }: any) {
  const { token, user, refreshUser } = useAuth();
  const [availablePlans, setAvailablePlans] = useState(plans);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanId>("premium_quarter");
  const [loading, setLoading] = useState(false);
  const [checkingReturn, setCheckingReturn] = useState(false);

  const isPremium = user?.isPremium || false;

  const selectedPlanInfo = useMemo(
    () => availablePlans.find((plan) => plan.id === selectedPlan),
    [availablePlans, selectedPlan]
  );

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        const result = await api.premiumPlans();
        if (!mounted || !result.plans.length) {
          return;
        }

        const nextPlans = result.plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.displayPrice,
          period: plan.durationMonths === 1 ? "/ tháng" : `/ ${plan.durationMonths} tháng`,
          discount:
            plan.id === "premium_quarter"
              ? "Phổ biến"
              : plan.id === "premium_half"
                ? "Tiết kiệm nhất"
                : null
        }));

        setAvailablePlans(nextPlans);
        if (!nextPlans.some((plan) => plan.id === selectedPlan)) {
          setSelectedPlan(nextPlans[0].id);
        }
      } catch {
        // Giữ danh sách mặc định để người dùng vẫn có thể thanh toán nếu API plans lỗi tạm thời.
      }
    }

    loadPlans();
    return () => {
      mounted = false;
    };
  }, [selectedPlan]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !token) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");

    if (paymentResult !== "success" && paymentResult !== "cancel") {
      return;
    }

    setCheckingReturn(true);
    refreshUser()
      .then(() => {
        Alert.alert(
          paymentResult === "success" ? "Đã quay lại từ PayOS" : "Đã hủy thanh toán",
          paymentResult === "success"
            ? "Daily Meal đang kiểm tra xác nhận thanh toán. Nếu PayOS đã gửi webhook thành công, Premium sẽ được kích hoạt ngay."
            : "Bạn có thể chọn lại gói Premium và thanh toán khi sẵn sàng."
        );
      })
      .finally(() => {
        setCheckingReturn(false);
        const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
      });
  }, [refreshUser, token]);

  async function handleUpgrade() {
    if (isPremium) {
      Alert.alert("Daily Premium", "Tài khoản của bạn đã có quyền lợi Premium.");
      return;
    }

    if (!token) {
      Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập lại trước khi thanh toán.");
      return;
    }

    setLoading(true);
    try {
      const payment = await api.createPayosPremiumPayment(token, { planId: selectedPlan });

      if (!payment.checkoutUrl) {
        throw new Error("PayOS chưa trả về link thanh toán.");
      }

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = payment.checkoutUrl;
        return;
      }

      const result = await WebBrowser.openBrowserAsync(payment.checkoutUrl);
      await refreshUser();

      Alert.alert(
        result.type === "cancel" ? "Đã đóng trang thanh toán" : "Đang xác nhận thanh toán",
        "Nếu bạn đã thanh toán thành công, Daily Premium sẽ được kích hoạt sau khi PayOS gửi xác nhận về server. Bạn có thể mở lại màn này để làm mới trạng thái."
      );
    } catch (error) {
      Alert.alert("Không thể tạo thanh toán", error instanceof Error ? error.message : "Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>Quyền lợi Premium</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.premiumBanner}>
          <Ionicons name="diamond" size={32} color={colors.yellow} />
          <AppText style={styles.bannerTitle}>Daily Premium</AppText>
          <AppText style={styles.bannerSubtitle}>
            Nâng tầm phong cách nấu ăn và chia sẻ của bạn lên đỉnh cao.
          </AppText>
        </View>

        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="sparkles" size={18} color={colors.yellow} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Mở khóa nhãn dán 3D độc quyền</AppText>
              <AppText style={styles.benefitDesc}>Bộ sticker đặc biệt chỉ dành cho thành viên Premium.</AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="nutrition" size={18} color={colors.greenDark} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Phân tích dinh dưỡng AI nâng cao</AppText>
              <AppText style={styles.benefitDesc}>
                Nhận định chi tiết calo, protein, carbs, fat và gợi ý sức khỏe.
              </AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="people" size={18} color={colors.greenDark} />
            </View>
            <View style={styles.benefitInfo}>
              <AppText style={styles.benefitTitle}>Nhóm gia đình chia sẻ</AppText>
              <AppText style={styles.benefitDesc}>
                Dùng chung quyền lợi Premium với tối đa 5 thành viên mà không phát sinh thêm phí.
              </AppText>
            </View>
          </View>
        </View>

        {!isPremium ? (
          <View style={styles.plansSection}>
            <AppText variant="caption" muted style={styles.sectionLabel}>
              Chọn gói đăng ký phù hợp
            </AppText>

            {checkingReturn && (
              <AppText muted style={styles.checkingText}>Đang cập nhật trạng thái Premium...</AppText>
            )}

            {availablePlans.map((plan) => {
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
              label={selectedPlanInfo ? `Thanh toán ${selectedPlanInfo.price} bằng PayOS` : "Thanh toán bằng PayOS"}
              onPress={handleUpgrade}
              loading={loading}
            />
          </View>
        ) : (
          <View style={styles.alreadyPremium}>
            <AppText style={styles.alreadyPremiumText}>
              Bạn đang sở hữu Daily Premium.
            </AppText>
            <AppText style={styles.alreadyPremiumSub} muted>
              Toàn bộ tính năng cao cấp đã được kích hoạt trên tài khoản của bạn.
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
