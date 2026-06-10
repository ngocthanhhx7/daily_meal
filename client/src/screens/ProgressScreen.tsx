import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post } from "../types/api";
import { getPostingProgressSummary } from "../utils/progressSummary";

function formatDay(date: Date) {
  return date.toLocaleDateString("vi-VN", { weekday: "short" }).replace(".", "");
}

function formatLastPost(value?: string) {
  if (!value) {
    return "Chưa có bài đăng";
  }

  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function ProgressScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }

    api
      .getUserPosts(token, user.id)
      .then((result) => setPosts(result.posts))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [token, user?.id]);

  const summary = useMemo(() => getPostingProgressSummary(posts), [posts]);
  const percent = Math.round(summary.completionRatio * 100);

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title" style={styles.title}>Theo dõi tiến độ</AppText>
          <AppText muted style={styles.subtitle}>Thói quen đăng bài ăn uống của bạn</AppText>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : posts.length ? (
        <>
          <View style={styles.hero}>
            <View>
              <AppText style={styles.heroLabel}>7 ngày gần nhất</AppText>
              <AppText style={styles.heroNumber}>{summary.daysPosted}/{summary.targetDays}</AppText>
              <AppText muted style={styles.heroHint}>ngày có bài đăng</AppText>
            </View>
            <View style={styles.percentBadge}>
              <AppText style={styles.percentText}>{percent}%</AppText>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, percent)}%` }]} />
          </View>

          <View style={styles.weekRow}>
            {summary.weekDays.map((day) => (
              <View key={day.date.toISOString()} style={styles.dayItem}>
                <View style={[styles.dayDot, day.posted && styles.dayDotActive]}>
                  {day.posted ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                <AppText style={styles.dayLabel}>{formatDay(day.date)}</AppText>
              </View>
            ))}
          </View>

          <View style={styles.metricGrid}>
            <MetricCard icon="flame-outline" label="Chuỗi hiện tại" value={`${summary.streakDays} ngày`} />
            <MetricCard icon="albums-outline" label="Tổng bài đã đăng" value={`${summary.totalPosts}`} />
            <MetricCard icon="calendar-outline" label="Lần cuối đăng" value={formatLastPost(summary.lastPostAt)} wide />
          </View>

          <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("Create")}>
            <Ionicons name="camera" size={20} color={colors.white} />
            <AppText style={styles.primaryActionText}>Đăng bữa ăn hôm nay</AppText>
          </Pressable>
        </>
      ) : (
        <EmptyState
          title="Chưa có tiến độ"
          message="Đăng bài đầu tiên để Daily Meal bắt đầu theo dõi thói quen của bạn."
          actionLabel="Đăng ảnh"
          onAction={() => navigation.navigate("Create")}
          icon="bar-chart-outline"
        />
      )}
    </AppScreen>
  );
}

function MetricCard({
  icon,
  label,
  value,
  wide
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.metricCard, wide && styles.metricCardWide]}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={19} color={colors.black} />
      </View>
      <AppText muted style={styles.metricLabel}>{label}</AppText>
      <AppText style={styles.metricValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 18
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.black
  },
  subtitle: {
    marginTop: 2
  },
  loading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center"
  },
  hero: {
    minHeight: 156,
    borderRadius: 24,
    backgroundColor: colors.green,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6
  },
  heroLabel: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 15
  },
  heroNumber: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 52,
    lineHeight: 58,
    marginTop: 8
  },
  heroHint: {
    color: "rgba(255,255,255,0.86)",
    fontFamily: fonts.medium
  },
  percentBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  percentText: {
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 24
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.canvasStrong,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: colors.yellow
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 7
  },
  dayItem: {
    flex: 1,
    alignItems: "center",
    gap: 7
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  dayDotActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  dayLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCard: {
    width: "48%",
    minHeight: 122,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8
  },
  metricCardWide: {
    width: "100%"
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas
  },
  metricLabel: {
    fontSize: 12
  },
  metricValue: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 19
  },
  primaryAction: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9
  },
  primaryActionText: {
    color: colors.white,
    fontFamily: fonts.bold
  }
});
