import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, useWindowDimensions, View, ScrollView, Image } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type {
  AdminDashboard,
  AdminAnalytics24h,
  AdminAnalytics24hPreset,
  AdminAnalyticsHeatmap,
  AdminAiReportMetric,
  AdminAiReportSection,
  AdminPostInsights,
  AdminPostMediaKind,
  AdminPostSortBy,
  AdminPayment,
  AdminPagination,
  AdminPostSummary,
  AdminRangePreset,
  PostImage,
  AdminReport,
  AdminReportItem,
  AdminUserDetail,
  AdminUserInsights,
  AdminUserSummary
} from "../types/api";
import {
  CategoryIcon,
  KPIIcon,
  PostsIcon,
  ReportsIcon,
  PaymentsIcon,
  AiIcon,
  UserIcon,
  AlertIcon,
  BagIcon,
  ClockIcon,
  CompassIcon,
  ArrowLeftIcon,
  RefreshIcon,
  LogoutIcon,
  MessageIcon
} from "../components/AdminIcons";
import { AdminDonutChart, AdminSeriesChart, AdminStackedBarChart } from "../components/admin-charts/AdminCharts";
import { interactionColors, toDonutData, toGiftedSeries, toStackedInteractionData } from "../components/admin-charts/chartData";

type AdminTab = "overview" | "analytics24h" | "analytics" | "posts" | "reports" | "payments" | "ai";
type AdminRange = AdminRangePreset;

const USER_PAGE_SIZE = 50;
const POST_PAGE_SIZE = 20;

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "analytics24h", label: "Analytics 24h" },
  { key: "analytics", label: "KPI" },
  { key: "posts", label: "Bài đăng" },
  { key: "reports", label: "Báo cáo" },
  { key: "payments", label: "Thanh toán" },
  { key: "ai", label: "Báo cáo AI" }
];

const tabIcons: Record<AdminTab, React.ComponentType<{ size?: number; color?: string; style?: any }>> = {
  overview: CategoryIcon,
  analytics24h: KPIIcon,
  analytics: KPIIcon,
  posts: PostsIcon,
  reports: ReportsIcon,
  payments: PaymentsIcon,
  ai: AiIcon
};

const rangeOptions: Array<{ key: AdminRange; label: string }> = [
  { key: "1d", label: "1 ngày" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "all", label: "Tất cả" }
];

const metricVectorIcons: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  "Người dùng trong khoảng": UserIcon,
  "Bài đăng trong khoảng": PostsIcon,
  "Tương tác trong khoảng": MessageIcon,
  "Doanh thu trong khoảng": PaymentsIcon,
  "Báo cáo mở": AlertIcon,
  "AI meal trong khoảng": BagIcon,
  "DAU / WAU / MAU": KPIIcon,
  "Phiên trung bình": ClockIcon,
  "Tổng thời gian dùng": ClockIcon,
  "Khung giờ cao điểm": ClockIcon,
  "Tỷ lệ bấm bảng tin": CompassIcon,
  "Phản hồi API": CompassIcon,
  "Tải ảnh": PostsIcon,
  "Lỗi runtime": AlertIcon,
  "Chuyển đổi creator": KPIIcon,
  "Hoàn tất đăng bài": ReportsIcon,
  "Hoàn tất AI món ăn": KPIIcon,
  "Thanh toán premium": PaymentsIcon
};

type AdminRangeParams = { range?: AdminRange; start?: string; end?: string; startTime?: string; endTime?: string };

function isoStartOfDate(value: string) {
  if (!value.trim()) return undefined;
  const date = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isoEndOfDate(value: string) {
  if (!value.trim()) return undefined;
  const date = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function rangeParams(range: AdminRange, startDate?: string, endDate?: string): AdminRangeParams {
  const start = startDate ? isoStartOfDate(startDate) : undefined;
  const end = endDate ? isoEndOfDate(endDate) : undefined;
  if (start || end) {
    return { range, start, end };
  }
  return { range };
}

function formatDuration(ms?: number) {
  const seconds = Math.round((ms ?? 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatHourLabel(hour?: number) {
  if (typeof hour !== "number" || !Number.isFinite(hour)) return "--:00";
  return `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;
}

function useWebGsapStagger(deps: React.DependencyList) {
  const rootRef = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    let cancelled = false;
    let context: { revert: () => void } | undefined;

    import("gsap").then(({ gsap }) => {
      if (cancelled || !rootRef.current) return;
      const root = rootRef.current as unknown as HTMLElement;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const targets = Array.from(root.querySelectorAll?.('[data-testid="admin-animate-card"], [data-testid="admin-animate-row"]') ?? []);
      const chartBars = Array.from(root.querySelectorAll?.('[data-testid="admin-chart-bar-fill"]') ?? []);
      if (!targets.length && !chartBars.length) return;

      context = gsap.context(() => {
        if (reduceMotion) {
          if (targets.length) {
            gsap.set(targets, { autoAlpha: 1, y: 0, scale: 1 });
          }
          if (chartBars.length) {
            gsap.set(chartBars, { scaleY: 1 });
          }
          return;
        }
        if (targets.length) {
          gsap.fromTo(
            targets,
            { autoAlpha: 0, y: 12, scale: 0.985 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.38,
              ease: "power2.out",
              stagger: 0.035,
              clearProps: "transform,opacity,visibility"
            }
          );
        }
        if (chartBars.length) {
          gsap.fromTo(
            chartBars,
            { scaleY: 0, transformOrigin: "bottom center" },
            { scaleY: 1, duration: 0.5, ease: "power3.out", stagger: 0.025, delay: 0.05, clearProps: "transform" }
          );
        }
      }, root);
    });

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, deps);

  return rootRef;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatNumberCompact(val: number) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return `${val}`;
}

function formatNumber(value?: number) {
  return Math.round(value ?? 0).toLocaleString();
}

function formatCurrency(value?: number) {
  return `${Math.round(value ?? 0).toLocaleString()} VND`;
}

function formatPercent(value?: number) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function metricStatus(value?: string) {
  if (!value || value === "not_instrumented") return "Chưa đo";
  if (value === "available_no_errors") return "Đã đo, không lỗi";
  return "Đã có dữ liệu";
}

function statusLabel(value?: string) {
  const labels: Record<string, string> = {
    visible: "Đang hiển thị",
    hidden: "Đã ẩn",
    review: "Cần xem lại",
    open: "Đang mở",
    resolved: "Đã xử lý",
    dismissed: "Đã bỏ qua",
    PAID: "Đã thanh toán",
    PENDING: "Đang chờ",
    PROCESSING: "Đang xử lý",
    CANCELLED: "Đã hủy",
    EXPIRED: "Hết hạn",
    public: "Công khai",
    friends: "Bạn bè",
    private: "Riêng tư",
    single_image: "1 hình",
    multi_image: "Nhiều hình",
    video: "Video",
    all: "Tất cả",
    report: "Báo cáo",
    restrict: "Hạn chế",
    block: "Chặn"
  };
  return value ? labels[value] ?? value : "-";
}

function adminMediaSource(image?: PostImage) {
  const url = image?.url;
  if (!url) {
    return undefined;
  }

  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:") || url.startsWith("blob:")) {
    return { uri: url };
  }

  return { uri: `${api.baseUrl}${url.startsWith("/") ? url : `/${url}`}` };
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View testID="admin-animate-card" style={[styles.card, style]}>{children}</View>;
}

function AdminPostPreview({ post, isDesktop }: { post: AdminPostSummary; isDesktop: boolean }) {
  const source = adminMediaSource(post.images?.[0]);
  const isVideo = post.mediaType === "video";
  const extraCount = Math.max(0, post.imageCount - 1);

  return (
    <View style={[styles.adminPostPreview, isDesktop ? styles.adminPostPreviewDesktop : styles.adminPostPreviewMobile]}>
      {isVideo ? (
        <View style={styles.adminPostPreviewPlaceholder}>
          <Ionicons name="play" size={22} color={colors.white} />
          <AppText variant="caption" style={styles.adminPostImageCountText}>
            Video
          </AppText>
        </View>
      ) : source ? (
        <Image source={source} style={styles.adminPostPreviewImage} resizeMode="cover" />
      ) : (
        <View style={styles.adminPostPreviewPlaceholder}>
          <PostsIcon size={20} color={colors.muted} />
          <AppText variant="caption" muted style={styles.adminPostPreviewText}>
            Không có ảnh
          </AppText>
        </View>
      )}
      {extraCount > 0 || isVideo ? (
        <View style={styles.adminPostImageCountBadge}>
          <AppText variant="caption" style={styles.adminPostImageCountText}>
            {isVideo ? "Video" : `+${extraCount}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function adminPostMediaLabel(post: AdminPostSummary) {
  if (post.mediaType === "video") {
    return "Video";
  }

  return `${post.imageCount} ảnh`;
}

function MetricCard({ label, value, note, isDesktop }: { label: string; value: string | number; note?: string; isDesktop?: boolean }) {
  const Icon = metricVectorIcons[label] || KPIIcon;
  return (
    <Card style={[styles.metricCard, isDesktop ? styles.metricCardDesktop : styles.metricCardMobile]}>
      <View style={styles.metricHeader}>
        <AppText variant="caption" muted style={styles.metricLabel}>
          {label}
        </AppText>
        <View style={styles.metricIconContainer}>
          <Icon size={15} color={colors.greenDark} />
        </View>
      </View>
      <AppText variant="title" style={styles.metricValue}>
        {typeof value === "number" ? formatNumber(value) : value}
      </AppText>
      {note ? (
        <AppText variant="caption" muted style={styles.metricNote}>
          {note}
        </AppText>
      ) : null}
    </Card>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <AppText variant="subtitle" style={styles.sectionTitle}>{title}</AppText>
        {subtitle ? <AppText muted variant="caption">{subtitle}</AppText> : null}
      </View>
    </View>
  );
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <AppText
      variant="caption"
      style={[
        styles.pill,
        tone === "good" && styles.pillGood,
        tone === "warn" && styles.pillWarn,
        tone === "bad" && styles.pillBad,
        tone === "neutral" && styles.pillNeutral
      ]}
    >
      {label}
    </AppText>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card style={styles.emptyStateCard}>
      <AlertIcon size={24} color={colors.muted} />
      <AppText muted style={{ textAlign: "center" }}>{label}</AppText>
    </Card>
  );
}

function ErrorText({ message }: { message?: string | null }) {
  return message ? (
    <View style={styles.errorContainer}>
      <AlertIcon size={16} color={colors.red} />
      <AppText style={styles.error}>{message}</AppText>
    </View>
  ) : null;
}

function RangeSelector({ value, onChange }: { value: AdminRange; onChange: (range: AdminRange) => void }) {
  return (
    <View style={styles.rangeSelector}>
      {rangeOptions.map((item) => {
        const active = item.key === value;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.rangeButton, active && styles.rangeButtonActive]}>
            <AppText variant="caption" style={[styles.rangeText, active && styles.rangeTextActive]}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const webDateInputStyle = {
  width: "100%",
  height: 42,
  border: "0",
  outline: "none",
  background: "transparent",
  color: colors.ink,
  fontFamily: fonts.regular,
  fontSize: 14
};

function DatePickerField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.datePickerField}>
        <AppText variant="caption" muted style={styles.datePickerLabel}>
          {label}
        </AppText>
        <View style={styles.webDateInputShell}>
          {React.createElement("input", {
            type: "date",
            value,
            name: label,
            onChange: (event: any) => onChange(event.currentTarget.value),
            style: webDateInputStyle,
            "aria-label": label
          } as any)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.datePickerField}>
      <TextField label={label} value={value} onChangeText={onChange} placeholder="Chọn ngày" />
    </View>
  );
}

function TimePickerField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const handleChange = (event: any) => onChange(event.currentTarget.value);

  if (Platform.OS === "web") {
    return (
      <View style={styles.datePickerField}>
        <AppText variant="caption" muted style={styles.datePickerLabel}>
          {label}
        </AppText>
        <View style={styles.webDateInputShell}>
          {React.createElement("input", {
            type: "time",
            value,
            name: label,
            onChange: handleChange,
            onInput: handleChange,
            style: webDateInputStyle,
            "aria-label": label
          } as any)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.datePickerField}>
      <TextField label={label} value={value} onChangeText={onChange} placeholder="HH:mm" />
    </View>
  );
}

function DateRangeControls({
  range,
  onRangeChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  compact
}: {
  range: AdminRange;
  onRangeChange: (range: AdminRange) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  compact?: boolean;
}) {
  const hasCustomDate = Boolean(startDate || endDate);

  return (
    <View style={[styles.dateFilterPanel, compact && styles.dateFilterPanelCompact]}>
      <RangeSelector value={range} onChange={onRangeChange} />
      <View style={[styles.customDateRow, compact && styles.customDateRowCompact]}>
        <DatePickerField label="Từ ngày" value={startDate} onChange={onStartDateChange} />
        <DatePickerField label="Đến ngày" value={endDate} onChange={onEndDateChange} />
      </View>
      {hasCustomDate ? (
        <Pressable
          onPress={() => {
            onStartDateChange("");
            onEndDateChange("");
          }}
          style={({ pressed }) => [styles.clearDateButton, pressed && styles.pressed]}
        >
          <AppText variant="caption" style={styles.clearDateText}>
            Xóa ngày
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function TimeRangeControls({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  compact
}: {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  compact?: boolean;
}) {
  const hasTime = Boolean(startTime || endTime);

  return (
    <View style={[styles.timeFilterPanel, compact && styles.dateFilterPanelCompact]}>
      <View style={styles.timeFilterHeader}>
        <ClockIcon size={15} color={colors.greenDark} />
        <AppText variant="caption" muted style={styles.filterGroupLabel}>
          Khung giờ trong ngày
        </AppText>
      </View>
      <View style={[styles.customDateRow, compact && styles.customDateRowCompact]}>
        <TimePickerField label="Từ giờ" value={startTime} onChange={onStartTimeChange} />
        <TimePickerField label="Đến giờ" value={endTime} onChange={onEndTimeChange} />
      </View>
      {hasTime ? (
        <Pressable
          onPress={() => {
            onStartTimeChange("");
            onEndTimeChange("");
          }}
          style={({ pressed }) => [styles.clearDateButton, pressed && styles.pressed]}
        >
          <AppText variant="caption" style={styles.clearDateText}>
            Xóa giờ
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function SmallFilterButton({
  label,
  detail,
  active,
  onPress
}: {
  label: string;
  detail?: string | number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}>
      <AppText variant="caption" style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </AppText>
      {detail !== undefined ? (
        <AppText variant="caption" style={[styles.filterChipDetail, active && styles.filterChipTextActive]}>
          {detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function AdminTabs({ activeTab, onChange }: { activeTab: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        const Icon = tabIcons[tab.key];
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tab, active && styles.tabActive]}>
            <Icon size={15} color={active ? colors.white : colors.ink} />
            <AppText variant="caption" style={[styles.tabText, active && styles.tabTextActive]}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DetailedChart({
  data,
  field,
  label,
  color
}: {
  data: AdminDashboard["charts"]["daily"];
  field: keyof Omit<AdminDashboard["charts"]["daily"][number], "date">;
  label: string;
  color: string;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 992;
  const isRevenue = field === "revenue";
  const compactData = isDesktop ? data.slice(-14) : data.slice(-7);

  const values = compactData.map((item) => Number(item[field] ?? 0));
  const total = values.reduce((sum, v) => sum + v, 0);
  const avg = values.length ? total / values.length : 0;
  const peak = Math.max(0, ...values);
  const peakIndex = values.indexOf(peak);
  const peakDate = peakIndex !== -1 ? compactData[peakIndex].date : "";

  function formatVal(val: number) {
    if (isRevenue) {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return `${val}`;
    }
    return formatNumberCompact(val);
  }

  function formatFullValue(val: number) {
    return isRevenue ? formatCurrency(val) : formatNumber(val);
  }

  const subtitle = `${isDesktop ? 14 : 7} mốc gần nhất · Tổng ${formatFullValue(total)} · TB ${formatFullValue(avg)} · Đỉnh ${formatFullValue(peak)}${peakDate ? ` (${peakDate.slice(5)})` : ""}`;

  return (
    <AdminSeriesChart
      title={label}
      subtitle={subtitle}
      data={compactData.map((item) => ({
        value: Number(item[field] ?? 0),
        label: item.date.slice(5)
      }))}
      color={color}
      type={field === "users" ? "area" : "bar"}
    />
  );
}

function BreakdownList({ title, data }: { title: string; data: Array<{ _id: string; count: number }> }) {
  const totalCount = data.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <Card style={styles.breakdownCard}>
      <AppText variant="subtitle" style={styles.breakdownTitle}>{title}</AppText>
      <View style={styles.breakdownContainer}>
        {data.length ? (
          data.map((item) => {
            const percent = (item.count / totalCount) * 100;
            return (
              <View key={`${title}-${item._id}`} style={styles.breakdownRow}>
                <View style={styles.breakdownHeaderRow}>
                  <AppText variant="body" style={styles.breakdownLabel}>{statusLabel(item._id)}</AppText>
                  <AppText variant="button" style={styles.breakdownValue}>
                    {formatNumber(item.count)} <AppText variant="caption" muted>({percent.toFixed(0)}%)</AppText>
                  </AppText>
                </View>
                <View style={styles.breakdownBarTrack}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: item._id === "premium" || item._id === "visible" || item._id === "PAID" ? colors.greenDark : colors.blue
                      }
                    ]}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <AppText muted>Chưa có dữ liệu.</AppText>
        )}
      </View>
    </Card>
  );
}

const reportSectionIcons: Record<AdminAiReportSection["key"], React.ComponentType<{ size?: number; color?: string; style?: any }>> = {
  technical: KPIIcon,
  behavioral: CompassIcon,
  traffic: UserIcon,
  conversion: PaymentsIcon
};

function legacyReportSections(report: AdminReport["report"]): AdminAiReportSection[] {
  return [
    {
      key: "technical",
      title: "1. Chỉ số hiệu suất kỹ thuật",
      objective: "Đánh giá tốc độ tải ảnh, lỗi runtime và thời gian phản hồi máy chủ.",
      metrics: [],
      insights: report.technical,
      conclusion: "Hiệu suất kỹ thuật là nền tảng để giữ trải nghiệm mạng xã hội ảnh đồ ăn mượt mà.",
      actions: []
    },
    {
      key: "behavioral",
      title: "2. Chỉ số tương tác người dùng",
      objective: "Đánh giá người dùng có ở lại, cuộn feed và tương tác với nội dung hay không.",
      metrics: [],
      insights: report.behavioral,
      conclusion: "Hành vi người dùng phản ánh chất lượng nội dung và khả năng giữ chân.",
      actions: []
    },
    {
      key: "traffic",
      title: "3. Chỉ số lưu lượng truy cập",
      objective: "Theo dõi tăng trưởng DAU/WAU/MAU, user mới và user quay lại.",
      metrics: [],
      insights: report.traffic,
      conclusion: "Tăng trưởng chỉ bền vững khi người dùng quay lại đủ tốt.",
      actions: []
    },
    {
      key: "conversion",
      title: "4. Chỉ số chuyển đổi",
      objective: "Đo khả năng biến người xem thành creator, người dùng AI món ăn hoặc premium.",
      metrics: [],
      insights: report.conversion,
      conclusion: "Chuyển đổi quyết định app có tạo được vòng lặp nội dung bền vững hay không.",
      actions: []
    }
  ];
}

function ReportList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return <AppText muted variant="caption">{emptyLabel}</AppText>;
  }

  return (
    <View style={styles.reportList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.reportItemRow}>
          <AppText style={styles.reportBullet}>{index + 1}</AppText>
          <AppText style={styles.reportItemText}>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

function ReportMetricCard({ metric }: { metric: AdminAiReportMetric }) {
  return (
    <View style={styles.reportMetricCard}>
      <AppText variant="caption" style={styles.reportMetricName}>{metric.name}</AppText>
      <AppText variant="subtitle" style={styles.reportMetricValue}>{metric.value}</AppText>
      <AppText variant="caption" style={styles.reportMetricAssessment}>{metric.assessment}</AppText>
      <AppText variant="caption" muted style={styles.reportMetricMeaning}>{metric.meaning}</AppText>
    </View>
  );
}

function ReportSectionBlock({ section }: { section: AdminAiReportSection }) {
  const Icon = reportSectionIcons[section.key];
  return (
    <View style={styles.reportSectionCard}>
      <View style={styles.reportSectionHeader}>
        <View style={styles.reportSectionIcon}>
          <Icon size={18} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.reportSectionTitle}>{section.title}</AppText>
          <AppText variant="caption" muted style={styles.reportObjective}>{section.objective}</AppText>
        </View>
      </View>

      {section.metrics.length ? (
        <View style={styles.reportMetricGrid}>
          {section.metrics.map((metric, index) => (
            <ReportMetricCard key={`${section.key}-${metric.name}-${index}`} metric={metric} />
          ))}
        </View>
      ) : null}

      <View style={styles.reportSubBlock}>
        <AppText variant="button" style={styles.reportSubTitle}>Phân tích</AppText>
        <ReportList items={section.insights} emptyLabel="Chưa có phân tích cho nhóm này." />
      </View>

      <View style={styles.reportConclusionBox}>
        <AppText variant="button" style={styles.reportSubTitle}>Kết luận</AppText>
        <AppText style={styles.reportConclusionText}>{section.conclusion || "Chưa có kết luận."}</AppText>
      </View>

      <View style={styles.reportSubBlock}>
        <AppText variant="button" style={styles.reportSubTitle}>Hành động đề xuất</AppText>
        <ReportList items={section.actions} emptyLabel="Chưa có hành động đề xuất." />
      </View>
    </View>
  );
}

function ReportOutput({ generatedReport }: { generatedReport: AdminReport | null }) {
  if (!generatedReport) {
    return <EmptyState label="Bấm tạo báo cáo để AI phân tích trên dữ liệu dashboard hiện tại." />;
  }

  const sections = generatedReport.report.sections?.length ? generatedReport.report.sections : legacyReportSections(generatedReport.report);

  return (
    <Card style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportHeaderIcon}>
          <AiIcon size={20} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.reportTitle}>{generatedReport.report.title}</AppText>
          <AppText variant="caption" muted>
            Tạo lúc {formatDate(generatedReport.generatedAt)} · {formatDate(generatedReport.range.start)} - {formatDate(generatedReport.range.end)}
          </AppText>
        </View>
      </View>
      <View style={styles.reportDivider} />

      <View style={styles.reportSummaryPanel}>
        <AppText variant="button" style={styles.reportSummaryTitle}>Tóm tắt điều hành</AppText>
        <ReportList items={generatedReport.report.executiveSummary} emptyLabel="Chưa có tóm tắt điều hành." />
      </View>

      <View style={styles.reportSectionStack}>
        {sections.map((section) => (
          <ReportSectionBlock key={section.key} section={section} />
        ))}
      </View>

      <View style={styles.reportBottomGrid}>
        <View style={styles.reportBottomPanel}>
          <AppText variant="button" style={styles.reportSubTitle}>Bất thường cần chú ý</AppText>
          <ReportList items={generatedReport.report.anomalies} emptyLabel="Chưa phát hiện bất thường rõ ràng." />
        </View>
        <View style={styles.reportBottomPanel}>
          <AppText variant="button" style={styles.reportSubTitle}>Ưu tiên tiếp theo</AppText>
          <ReportList items={generatedReport.report.priorityActions} emptyLabel="Chưa có ưu tiên." />
        </View>
        <View style={styles.reportBottomPanel}>
          <AppText variant="button" style={styles.reportSubTitle}>Rủi ro dữ liệu</AppText>
          <ReportList items={generatedReport.report.risks} emptyLabel="Chưa có rủi ro dữ liệu." />
        </View>
      </View>
    </Card>
  );
}

function HeaderIconButton({
  icon: IconComponent,
  onPress,
  variant = "default",
  disabled
}: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  onPress: () => void;
  variant?: "default" | "danger" | "success" | "primary";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.headerIconBtn,
        variant === "danger" && styles.headerIconBtnDanger,
        variant === "success" && styles.headerIconBtnSuccess,
        variant === "primary" && styles.headerIconBtnPrimary,
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <IconComponent
        size={18}
        color={
          variant === "danger" || variant === "success" || variant === "primary"
            ? colors.white
            : colors.ink
        }
      />
    </Pressable>
  );
}

const analytics24hPresetOptions: Array<{ key: AdminAnalytics24hPreset; label: string }> = [
  { key: "last24h", label: "24 giờ" },
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "custom", label: "Tùy chỉnh" }
];

function sourceColor(source: string, index: number) {
  const palette = ["#2F80ED", "#27AE60", "#F2994A", "#EB5757", "#9B51E0", "#00A3A3"];
  const normalized = source.toLowerCase();
  if (normalized.includes("facebook")) return "#2F80ED";
  if (normalized.includes("google")) return "#27AE60";
  if (normalized.includes("zalo")) return "#00A3A3";
  if (normalized.includes("tiktok")) return "#191B1F";
  if (normalized.includes("direct")) return colors.greenDark;
  return palette[index % palette.length];
}

function AnalyticsHeatmapCard({ heatmap }: { heatmap: AdminAnalyticsHeatmap | null }) {
  const cells = heatmap?.cells ?? [];
  const max = Math.max(1, ...cells.map((cell) => cell.value));
  const days = [...new Set(cells.map((cell) => cell.day))];
  const valueByKey = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell.value]));

  return (
    <Card style={styles.analyticsHeatmapCard}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.reportMiniTitle}>Heatmap hoạt động</AppText>
          <AppText muted variant="caption">Cường độ event theo ngày và giờ, timezone Asia/Ho_Chi_Minh.</AppText>
        </View>
      </View>
      {cells.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.heatmapWrap}>
            <View style={styles.heatmapHourRow}>
              <View style={styles.heatmapDayLabel} />
              {Array.from({ length: 24 }, (_, hour) => (
                <AppText key={`hour-${hour}`} variant="caption" style={styles.heatmapHourLabel}>
                  {hour % 2 === 0 ? String(hour).padStart(2, "0") : ""}
                </AppText>
              ))}
            </View>
            {days.map((day) => (
              <View key={day} style={styles.heatmapRow}>
                <AppText variant="caption" style={styles.heatmapDayLabel} numberOfLines={1}>
                  {day.slice(5)}
                </AppText>
                {Array.from({ length: 24 }, (_, hour) => {
                  const value = valueByKey.get(`${day}-${hour}`) ?? 0;
                  const opacity = value > 0 ? 0.18 + (value / max) * 0.72 : 0.04;
                  return (
                    <View
                      key={`${day}-${hour}`}
                      style={[
                        styles.heatmapCell,
                        {
                          backgroundColor: `rgba(82,106,69,${opacity})`
                        }
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <EmptyState label="Chưa có dữ liệu heatmap trong khoảng này." />
      )}
    </Card>
  );
}

function Analytics24hTab({
  analytics,
  heatmap,
  isDesktop,
  preset,
  onPresetChange,
  activityChartMode,
  onActivityChartModeChange,
  interactionChartMode,
  onInteractionChartModeChange
}: {
  analytics: AdminAnalytics24h | null;
  heatmap: AdminAnalyticsHeatmap | null;
  isDesktop: boolean;
  preset: AdminAnalytics24hPreset;
  onPresetChange: (preset: AdminAnalytics24hPreset) => void;
  activityChartMode: "area" | "line" | "bar";
  onActivityChartModeChange: (mode: "area" | "line" | "bar") => void;
  interactionChartMode: "stacked" | "donut";
  onInteractionChartModeChange: (mode: "stacked" | "donut") => void;
}) {
  if (!analytics) {
    return <EmptyState label="Chưa tải được dữ liệu Analytics 24h." />;
  }

  const sourceColorMap = Object.fromEntries(analytics.sourceTraffic.map((item, index) => [item.source, sourceColor(item.source, index)]));
  const sourceDonutData = toDonutData(
    analytics.sourceTraffic.map((item) => ({ type: item.source, count: item.events })),
    sourceColorMap
  );
  const interactionLegend = [
    { label: "Thích", color: interactionColors.likes },
    { label: "Lưu", color: interactionColors.saves },
    { label: "Bình luận", color: interactionColors.comments }
  ];

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader
        title="Báo cáo Analytics 24h"
        subtitle={`Cập nhật từ ${formatDate(analytics.range.start)} đến ${formatDate(analytics.range.end)} · ${analytics.range.timezone}`}
      />
      <Card style={styles.filterPanelCard}>
        <View style={styles.filterGroup}>
          <AppText variant="caption" muted style={styles.filterGroupLabel}>Khoảng thời gian</AppText>
          <View style={styles.filterChipRow}>
            {analytics24hPresetOptions.map((option) => (
              <SmallFilterButton
                key={option.key}
                label={option.label}
                active={preset === option.key}
                onPress={() => onPresetChange(option.key)}
              />
            ))}
          </View>
        </View>
      </Card>

      <View style={isDesktop ? styles.desktopGrid4 : styles.grid}>
        <MetricCard label="Người dùng trong khoảng" value={analytics.summary.activeUsers} note={`${formatNumber(analytics.summary.newUsers)} user mới`} isDesktop={isDesktop} />
        <MetricCard label="Bài đăng trong khoảng" value={analytics.summary.posts} note="Bài mới theo giờ" isDesktop={isDesktop} />
        <MetricCard label="Tương tác trong khoảng" value={analytics.summary.interactions} note={`${formatNumber(analytics.summary.likes)} thích · ${formatNumber(analytics.summary.saves)} lưu · ${formatNumber(analytics.summary.comments)} bình luận`} isDesktop={isDesktop} />
        <MetricCard label="Doanh thu trong khoảng" value={formatCurrency(analytics.summary.revenue)} note={`${formatNumber(analytics.summary.paymentSuccess)} thành công · ${formatNumber(analytics.summary.paymentFailed)} lỗi`} isDesktop={isDesktop} />
        <MetricCard label="AI meal trong khoảng" value={analytics.summary.aiMealUsage} note={`${formatNumber(analytics.aiFunnel.purchasedAfterAi)} mua sau AI`} isDesktop={isDesktop} />
        <MetricCard label="Thanh toán premium" value={formatPercent(analytics.aiFunnel.conversionRate)} note="AI Meal -> Purchase" isDesktop={isDesktop} />
        <MetricCard label="Báo cáo mở" value={analytics.summary.reportsOpened} note={`${formatNumber(analytics.reportMetrics.pending)} đang chờ`} isDesktop={isDesktop} />
        <MetricCard label="Phản hồi API" value={analytics.tables.recentImportantEvents.length} note="Sự kiện kỹ thuật quan trọng" isDesktop={isDesktop} />
      </View>

      <Card style={styles.filterPanelCard}>
        <View style={isDesktop ? styles.filterPanelGrid : styles.filterPanelStack}>
          <View style={styles.filterGroup}>
            <AppText variant="caption" muted style={styles.filterGroupLabel}>Biểu đồ hoạt động</AppText>
            <View style={styles.filterChipRow}>
              <SmallFilterButton label="Vùng" active={activityChartMode === "area"} onPress={() => onActivityChartModeChange("area")} />
              <SmallFilterButton label="Đường" active={activityChartMode === "line"} onPress={() => onActivityChartModeChange("line")} />
              <SmallFilterButton label="Cột" active={activityChartMode === "bar"} onPress={() => onActivityChartModeChange("bar")} />
            </View>
          </View>
          <View style={styles.filterGroup}>
            <AppText variant="caption" muted style={styles.filterGroupLabel}>Tương tác</AppText>
            <View style={styles.filterChipRow}>
              <SmallFilterButton label="Stacked" active={interactionChartMode === "stacked"} onPress={() => onInteractionChartModeChange("stacked")} />
              <SmallFilterButton label="Donut" active={interactionChartMode === "donut"} onPress={() => onInteractionChartModeChange("donut")} />
            </View>
          </View>
        </View>
      </Card>

      <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
        <AdminSeriesChart
          title="Người dùng active theo giờ"
          subtitle="Unique user/session có event trong khoảng lọc."
          data={toGiftedSeries(analytics.hourly, "activeUsers", { maxPoints: 24 })}
          color={colors.greenDark}
          type={activityChartMode}
        />
        <AdminSeriesChart
          title="Doanh thu theo giờ"
          subtitle="Tổng payment PAID theo từng giờ."
          data={toGiftedSeries(analytics.hourly, "revenue", { maxPoints: 24 })}
          color={colors.yellow}
          type="bar"
        />
      </View>

      <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
        {interactionChartMode === "stacked" ? (
          <AdminStackedBarChart
            title="Tương tác theo loại"
            subtitle="Like, save và comment theo từng giờ."
            data={toStackedInteractionData(analytics.hourly, { maxPoints: 24 })}
            legend={interactionLegend}
          />
        ) : (
          <AdminDonutChart
            title="Tỷ trọng tương tác"
            subtitle="Tổng like, save và comment trong khoảng lọc."
            data={toDonutData(analytics.interactionBreakdown, interactionColors)}
            centerLabel={formatNumber(analytics.summary.interactions)}
            legend={interactionLegend}
          />
        )}
        <AdminDonutChart
          title="Nguồn truy cập"
          subtitle="Dựa trên UTM/referrer trong AnalyticsEvent."
          data={sourceDonutData}
          centerLabel={formatNumber(analytics.sourceTraffic.reduce((sum, item) => sum + item.events, 0))}
          legend={analytics.sourceTraffic.map((item, index) => ({ label: item.source, color: sourceColor(item.source, index) }))}
        />
      </View>

      <View style={isDesktop ? styles.desktopGrid3 : styles.grid}>
        <MetricCard label="AI Meal usage" value={analytics.aiFunnel.usersUsedAi} note="Users có phân tích món ăn" isDesktop={isDesktop} />
        <MetricCard label="Users đã mua sau AI" value={analytics.aiFunnel.purchasedAfterAi} note={formatPercent(analytics.aiFunnel.conversionRate)} isDesktop={isDesktop} />
        <MetricCard label="Users chưa mua sau AI" value={analytics.aiFunnel.onlyAiNoPurchase} note="Có AI Meal, chưa có PAID payment" isDesktop={isDesktop} />
      </View>

      <AnalyticsHeatmapCard heatmap={heatmap} />

      <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
        <Card style={styles.reportMiniCard}>
          <AppText variant="subtitle" style={styles.reportMiniTitle}>Top actions</AppText>
          {analytics.tables.topActions.length ? (
            analytics.tables.topActions.map((item) => (
              <View key={item.name} style={styles.usageReportRow}>
                <AppText variant="body" style={styles.flex} numberOfLines={1}>{item.name}</AppText>
                <AppText variant="button">{formatNumber(item.count)}</AppText>
              </View>
            ))
          ) : (
            <EmptyState label="Chưa có action." />
          )}
        </Card>
        <Card style={styles.reportMiniCard}>
          <AppText variant="subtitle" style={styles.reportMiniTitle}>Cần chú ý</AppText>
          {[...analytics.tables.pendingReports, ...analytics.tables.paymentErrors].slice(0, 6).length ? (
            [...analytics.tables.pendingReports, ...analytics.tables.paymentErrors].slice(0, 6).map((item: any) => (
              <View key={item.id} style={styles.usageReportRow}>
                <AppText variant="body" style={styles.flex} numberOfLines={1}>{item.note ?? item.status}</AppText>
                <Pill label={item.status} tone={item.status === "open" ? "warn" : "bad"} />
              </View>
            ))
          ) : (
            <EmptyState label="Không có báo cáo hoặc lỗi thanh toán trong khoảng này." />
          )}
        </Card>
      </View>
    </View>
  );
}

function Sidebar({
  navigation,
  activeTab,
  onTabChange,
  currentScreen,
  loading,
  onRefresh,
  handleSignOut,
  busyAction
}: {
  navigation: any;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  currentScreen: "dashboard" | "users" | "user-detail";
  loading?: boolean;
  onRefresh?: () => void;
  handleSignOut: () => void;
  busyAction?: string | null;
}) {
  const tabsList: Array<{ key: AdminTab; label: string }> = [
    { key: "overview", label: "Tổng quan" },
    { key: "analytics24h", label: "Analytics 24h" },
    { key: "analytics", label: "KPI" },
    { key: "posts", label: "Bài đăng" },
    { key: "reports", label: "Báo cáo" },
    { key: "payments", label: "Thanh toán" },
    { key: "ai", label: "Báo cáo AI" }
  ];

  function handleTabPress(tabKey: AdminTab) {
    if (currentScreen === "dashboard") {
      onTabChange?.(tabKey);
    } else {
      navigation.navigate("AdminDashboard", { tab: tabKey });
    }
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <Image
          source={require("../../assets/logo/logo.png")}
          style={{ width: 32, height: 32, borderRadius: 8, marginRight: 8 }}
        />
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.brandTitle}>Daily Meal</AppText>
          <AppText variant="caption" style={styles.brandSubtitle}>Bộ quản trị</AppText>
        </View>
      </View>

      <View style={styles.sidebarDivider} />

      <AppText variant="label" style={styles.sidebarGroupTitle}>Bảng điều khiển</AppText>
      <View style={styles.sidebarNav}>
        {tabsList.map((tab) => {
          const isActive = currentScreen === "dashboard" && activeTab === tab.key;
          const Icon = tabIcons[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              style={({ pressed }) => [
                styles.sidebarNavItem,
                isActive && styles.sidebarNavItemActive,
                pressed && styles.pressed
              ]}
            >
              <Icon
                size={16}
                color={isActive ? colors.white : "rgba(255,255,255,0.6)"}
              />
              <AppText
                variant="body"
                style={[
                  styles.sidebarNavLabel,
                  isActive && styles.sidebarNavLabelActive
                ]}
              >
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sidebarDivider} />

      <AppText variant="label" style={styles.sidebarGroupTitle}>Hệ thống</AppText>
      <View style={styles.sidebarNav}>
        <Pressable
          onPress={() => navigation.navigate("AdminUsers")}
          style={({ pressed }) => [
            styles.sidebarNavItem,
            currentScreen === "users" && styles.sidebarNavItemActive,
            pressed && styles.pressed
          ]}
        >
          <UserIcon
            size={16}
            color={currentScreen === "users" ? colors.white : "rgba(255,255,255,0.6)"}
          />
          <AppText
            variant="body"
            style={[
              styles.sidebarNavLabel,
              currentScreen === "users" && styles.sidebarNavLabelActive
            ]}
          >
            Người dùng
          </AppText>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.sidebarFooter}>
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            disabled={loading}
            style={({ pressed }) => [styles.sidebarActionBtn, pressed && styles.pressed]}
          >
            <RefreshIcon size={15} color={colors.white} />
            <AppText variant="caption" style={styles.sidebarActionText}>
              {loading ? "Đang tải..." : "Làm mới"}
            </AppText>
          </Pressable>
        )}

        <Pressable
          onPress={handleSignOut}
          disabled={busyAction === "sign-out"}
          style={({ pressed }) => [
            styles.sidebarActionBtn,
            styles.sidebarActionBtnDanger,
            pressed && styles.pressed
          ]}
        >
          <LogoutIcon size={15} color={colors.white} />
          <AppText variant="caption" style={styles.sidebarActionTextDanger}>
            {busyAction === "sign-out" ? "Thoát..." : "Đăng xuất"}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function AdminLoginScreen({ navigation }: any) {
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await signInAdmin(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? "Đăng nhập admin thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.loginWrap }} noBackground>
      <View style={styles.loginCard}>
        <Image
          source={require("../../assets/logo/logo.png")}
          style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 8 }}
        />
        <AppText variant="title" style={styles.loginTitle}>Daily Meal Admin</AppText>
        <AppText muted style={styles.loginSubtitle}>
          Đăng nhập bằng tài khoản quản trị đã cấu hình trên server.
        </AppText>
        <View style={{ width: "100%", gap: 14, marginVertical: 12 }}>
          <TextField label="Email admin" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextField label="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
        </View>
        <ErrorText message={error} />
        <AppButton style={{ width: "100%", marginTop: 8 }} label={submitting ? "Đang đăng nhập..." : "Đăng nhập admin"} onPress={submit} disabled={submitting} />
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <AppText muted variant="caption">Quay lại trang chính</AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}

export function AdminDashboardScreen({ route, navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [range, setRange] = useState<AdminRange>("7d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [dashboardStartTime, setDashboardStartTime] = useState("");
  const [dashboardEndTime, setDashboardEndTime] = useState("");
  const [analytics24hPreset, setAnalytics24hPreset] = useState<AdminAnalytics24hPreset>("last24h");
  const [activityChartMode, setActivityChartMode] = useState<"area" | "line" | "bar">("area");
  const [interactionChartMode, setInteractionChartMode] = useState<"stacked" | "donut">("stacked");
  const [postMediaKind, setPostMediaKind] = useState<AdminPostMediaKind>("all");
  const [postSortBy, setPostSortBy] = useState<AdminPostSortBy>("createdAt");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [analytics24h, setAnalytics24h] = useState<AdminAnalytics24h | null>(null);
  const [analyticsHeatmap, setAnalyticsHeatmap] = useState<AdminAnalyticsHeatmap | null>(null);
  const [postInsights, setPostInsights] = useState<AdminPostInsights | null>(null);
  const [posts, setPosts] = useState<AdminPostSummary[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [postsPagination, setPostsPagination] = useState<AdminPagination | null>(null);
  const [generatedReport, setGeneratedReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDesktop = width >= 992;
  const compactHeader = width < 760;
  const dashboardAnimationRef = useWebGsapStagger([
    activeTab,
    range,
    customStartDate,
    customEndDate,
    dashboardStartTime,
    dashboardEndTime,
    analytics24hPreset,
    activityChartMode,
    interactionChartMode,
    posts.length,
    postInsights?.summary.totalPosts ?? 0
  ]);
  const dashboardRangeParams = useMemo(
    () => ({
      ...rangeParams(range, customStartDate, customEndDate),
      startTime: dashboardStartTime || undefined,
      endTime: dashboardEndTime || undefined
    }),
    [range, customStartDate, customEndDate, dashboardStartTime, dashboardEndTime]
  );
  const postQueryParams = useMemo(
    () => ({
      ...dashboardRangeParams,
      mediaKind: postMediaKind,
      sortBy: postSortBy,
      sortOrder: "desc" as const
    }),
    [dashboardRangeParams, postMediaKind, postSortBy]
  );
  const analytics24hParams = useMemo(() => {
    const params: { preset: AdminAnalytics24hPreset; from?: string; to?: string; timezone: string } = {
      preset: analytics24hPreset,
      timezone: "Asia/Ho_Chi_Minh"
    };
    if (analytics24hPreset === "custom") {
      params.from = isoStartOfDate(customStartDate);
      params.to = isoEndOfDate(customEndDate);
    }
    return params;
  }, [analytics24hPreset, customStartDate, customEndDate]);

  const loadDashboard = useCallback(async () => {
    if (!adminToken) return;
    setError(null);
    setLoading(true);
    try {
      const [dashboardResult, postsResult, reportsResult, paymentsResult, postInsightsResult, analytics24hResult, heatmapResult] = await Promise.all([
        api.adminDashboard(adminToken, dashboardRangeParams),
        api.adminPosts(adminToken, { ...postQueryParams, limit: POST_PAGE_SIZE }),
        api.adminReports(adminToken, { status: "open", limit: 20 }),
        api.adminPayments(adminToken, { limit: 20 }),
        api.adminPostInsights(adminToken, postQueryParams),
        api.adminAnalytics24h(adminToken, analytics24hParams),
        api.adminAnalyticsHeatmap(adminToken, { ...analytics24hParams, metric: "events" })
      ]);
      setDashboard(dashboardResult);
      setPosts(postsResult.posts);
      setPostsPagination(postsResult.pagination);
      setReports(reportsResult.reports);
      setPayments(paymentsResult.payments);
      setPostInsights(postInsightsResult);
      setAnalytics24h(analytics24hResult);
      setAnalyticsHeatmap(heatmapResult);
    } catch (err: any) {
      setError(err?.message ?? "Không tải được dashboard admin");
    } finally {
      setLoading(false);
    }
  }, [adminToken, dashboardRangeParams, postQueryParams, analytics24hParams]);

  const loadMorePosts = useCallback(async () => {
    if (!adminToken || !postsPagination || loadingMorePosts || posts.length >= postsPagination.total || postsPagination.page >= postsPagination.pages) {
      return;
    }

      setLoadingMorePosts(true);
    try {
      const nextPage = postsPagination.page + 1;
      const result = await api.adminPosts(adminToken, { ...postQueryParams, limit: postsPagination.limit, page: nextPage });
      setPosts((current) => [...current, ...result.posts]);
      setPostsPagination(result.pagination);
    } catch (err: any) {
      setActionError(err?.message ?? "Không tải thêm được bài đăng.");
    } finally {
      setLoadingMorePosts(false);
    }
  }, [adminToken, loadingMorePosts, postQueryParams, posts.length, postsPagination]);

  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  useEffect(() => {
    setGeneratedReport(null);
    loadDashboard();
  }, [loadDashboard]);

  async function handleSignOut() {
    setActionError(null);
    setBusyAction("sign-out");
    try {
      await signOut();
    } catch (err: any) {
      setActionError(err?.message ?? "Không đăng xuất được. Vui lòng thử lại.");
    } finally {
      setBusyAction(null);
    }
  }

  async function moderatePost(post: AdminPostSummary, moderationStatus: "visible" | "hidden" | "review") {
    if (!adminToken) return;
    setBusyAction(`post-${post.id}`);
    setActionError(null);
    try {
      const result = await api.adminModeratePost(adminToken, post.id, {
        moderationStatus,
        reason: moderationStatus === "hidden" ? "Ẩn từ dashboard admin" : "Cập nhật kiểm duyệt từ dashboard admin"
      });
      setPosts((current) => current.map((item) => (item.id === post.id ? result.post : item)));
      if (dashboard) {
        const [refreshedDashboard, refreshedPostInsights] = await Promise.all([
          api.adminDashboard(adminToken, dashboardRangeParams),
          api.adminPostInsights(adminToken, postQueryParams)
        ]);
        setDashboard(refreshedDashboard);
        setPostInsights(refreshedPostInsights);
      }
    } catch (err: any) {
      setActionError(err?.message ?? "Không cập nhật được trạng thái bài đăng.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateReport(report: AdminReportItem, status: "resolved" | "dismissed" | "open") {
    if (!adminToken) return;
    setBusyAction(`report-${report.id}`);
    setActionError(null);
    try {
      const result = await api.adminUpdateReport(adminToken, report.id, {
        status,
        adminNote: status === "open" ? "Mở lại báo cáo" : "Đã xử lý trong dashboard admin"
      });
      setReports((current) => current.map((item) => (item.id === report.id ? result.report : item)).filter((item) => item.status === "open"));
      await loadDashboard();
    } catch (err: any) {
      setActionError(err?.message ?? "Không cập nhật được báo cáo.");
    } finally {
      setBusyAction(null);
    }
  }

  async function generateReport() {
    if (!adminToken) return;
    setBusyAction("ai-report");
    setActionError(null);
    try {
      const result = await api.adminAiReport(adminToken, dashboardRangeParams);
      setGeneratedReport(result);
    } catch (err: any) {
      setActionError(err?.message ?? "Không tạo được báo cáo AI");
    } finally {
      setBusyAction(null);
    }
  }

  const overviewMetrics = useMemo(() => {
    if (!dashboard) return [];
    const inRange = dashboard.totalsInRange;
    const allTime = dashboard.totalsAllTime;
    return [
      ["Người dùng trong khoảng", inRange.users, `Tất cả: ${formatNumber(allTime.users)} · Premium: ${formatNumber(allTime.premiumUsers)}`],
      ["Bài đăng trong khoảng", inRange.posts, `Tất cả: ${formatNumber(allTime.posts)} · Đang ẩn: ${formatNumber(allTime.hiddenPosts)}`],
      ["Tương tác trong khoảng", inRange.likes + inRange.saves + inRange.comments, "like + save + comment"],
      ["Doanh thu trong khoảng", formatCurrency(inRange.revenue), `Tất cả: ${formatCurrency(allTime.revenue)}`],
      ["Báo cáo mở", inRange.openReports, `Tất cả: ${formatNumber(allTime.openReports)} cần xử lý`],
      ["AI meal trong khoảng", inRange.meals, `Tất cả: ${formatNumber(allTime.meals)} lượt phân tích món ăn`]
    ] as Array<[string, string | number, string]>;
  }, [dashboard]);

  const canLoadMorePosts = Boolean(
    postsPagination &&
      postsPagination.page < postsPagination.pages &&
      posts.length < postsPagination.total
  );
  const loadedPostCount = posts.length;
  const totalPostCount = postsPagination?.total ?? posts.length;
  const showDashboardTimeControls = activeTab === "overview" || activeTab === "analytics" || activeTab === "analytics24h";
  const postMediaBreakdown = useMemo(() => {
    const counts = new Map<AdminPostMediaKind, number>();
    postInsights?.mediaBreakdown.forEach((item) => counts.set(item.key, item.count));
    return counts;
  }, [postInsights]);

  if (loading && !dashboard) {
    return (
      <AppScreen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.greenDark} />
          <AppText muted style={{ marginTop: 12 }}>Đang tải dữ liệu dashboard...</AppText>
        </View>
      </AppScreen>
    );
  }

  const dashboardContent = dashboard ? (
    <View style={styles.workspaceBody}>
      {activeTab === "overview" && (
        <>
          <View style={isDesktop ? styles.desktopGrid3 : styles.grid}>
            {overviewMetrics.map(([label, value, note]) => (
              <MetricCard key={label} label={label} value={value} note={note} isDesktop={isDesktop} />
            ))}
          </View>
          <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
            <DetailedChart data={dashboard.charts.daily} field="users" label="Người dùng mới" color={colors.greenDark} />
            <DetailedChart data={dashboard.charts.daily} field="interactions" label="Tương tác" color={colors.blue} />
          </View>
          <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
            <BreakdownList title="Người dùng" data={dashboard.breakdowns.usersByPremium} />
            <BreakdownList title="Bài đăng theo trạng thái" data={dashboard.breakdowns.postsByModeration} />
          </View>
          <SectionHeader title="Nhật ký hệ thống (Audit logs)" />
          <View style={styles.auditList}>
            {dashboard.recent.audit.length ? (
              dashboard.recent.audit.map((item) => (
                <View key={item.id} style={styles.auditItem}>
                  <View style={styles.auditIconCol}>
                    <View style={styles.auditIconBg}>
                      <ReportsIcon size={14} color={colors.greenDark} />
                    </View>
                    <View style={styles.auditLine} />
                  </View>
                  <View style={styles.auditContentCol}>
                    <View style={styles.auditHeader}>
                      <AppText variant="button" style={styles.auditActionText}>{item.action}</AppText>
                      <AppText variant="caption" muted>{formatDate(item.createdAt)}</AppText>
                    </View>
                    <AppText variant="body" muted style={styles.auditDetails}>
                      Đối tượng: <AppText variant="body" style={{ color: colors.ink }}>{item.targetType}</AppText> (ID: {item.targetId})
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState label="Chưa có audit action." />
            )}
          </View>
        </>
      )}

      {activeTab === "analytics24h" && (
        <Analytics24hTab
          analytics={analytics24h}
          heatmap={analyticsHeatmap}
          isDesktop={isDesktop}
          preset={analytics24hPreset}
          onPresetChange={setAnalytics24hPreset}
          activityChartMode={activityChartMode}
          onActivityChartModeChange={setActivityChartMode}
          interactionChartMode={interactionChartMode}
          onInteractionChartModeChange={setInteractionChartMode}
        />
      )}

      {activeTab === "analytics" && (
        <>
          <View style={isDesktop ? styles.desktopGrid3 : styles.grid}>
            <MetricCard label="DAU / WAU / MAU" value={`${dashboard.analytics.activeUsers.dau} / ${dashboard.analytics.activeUsers.wau} / ${dashboard.analytics.activeUsers.mau}`} note={`${dashboard.analytics.activeUsers.returning} user quay lại`} isDesktop={isDesktop} />
            <MetricCard label="Phiên trung bình" value={`${Math.round(dashboard.analytics.sessions.averageDurationMs / 1000)}s`} note={`Thoát nhanh ${formatPercent(dashboard.analytics.sessions.bounceRate)}`} isDesktop={isDesktop} />
            <MetricCard label="Tỷ lệ bấm bảng tin" value={formatPercent(dashboard.analytics.feed.ctr)} note={`Độ sâu cuộn TB ${formatNumber(dashboard.analytics.feed.averageScrollDepth)}%`} isDesktop={isDesktop} />
            <MetricCard label="Phản hồi API" value={`${Math.round(dashboard.analytics.technical.averageApiResponseMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.apiResponseTime)} isDesktop={isDesktop} />
            <MetricCard label="Tải ảnh" value={`${Math.round(dashboard.analytics.technical.averageImageLoadMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.imageLoadSpeed)} isDesktop={isDesktop} />
            <MetricCard label="Lỗi runtime" value={dashboard.analytics.technical.runtimeErrors} note={`Tỷ lệ lỗi ${formatPercent(dashboard.analytics.technical.crashRate)}`} isDesktop={isDesktop} />
          </View>
          <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
            <DetailedChart data={dashboard.charts.daily} field="posts" label="Bài đăng mới" color={colors.green} />
            <DetailedChart data={dashboard.charts.daily} field="apiErrors" label="Lỗi runtime/API" color={colors.red} />
          </View>
          <View style={isDesktop ? styles.desktopGrid4 : styles.grid}>
            <MetricCard label="Chuyển đổi creator" value={formatPercent(dashboard.analytics.creatorConversion.rate)} note={`${dashboard.analytics.creatorConversion.completed}/${dashboard.analytics.creatorConversion.started}`} isDesktop={isDesktop} />
            <MetricCard label="Hoàn tất đăng bài" value={formatPercent(dashboard.analytics.postCreation.completionRate)} note={`${dashboard.analytics.postCreation.completed}/${dashboard.analytics.postCreation.started}`} isDesktop={isDesktop} />
            <MetricCard label="Hoàn tất AI món ăn" value={formatPercent(dashboard.analytics.mealAnalysis.completionRate)} note={`${dashboard.analytics.mealAnalysis.completed}/${dashboard.analytics.mealAnalysis.started}`} isDesktop={isDesktop} />
            <MetricCard label="Thanh toán premium" value={formatPercent(dashboard.analytics.premiumFunnel.paymentCompletionRate)} note={`${dashboard.analytics.premiumFunnel.paymentCompleted}/${dashboard.analytics.premiumFunnel.paymentStarted}`} isDesktop={isDesktop} />
          </View>
        </>
      )}

      {activeTab === "posts" && (
        <View style={{ gap: 14 }}>
          <SectionHeader title="Quản lý bài đăng" subtitle="Kiểm duyệt mềm: ẩn, đưa vào review hoặc khôi phục." />
          <Card style={styles.filterPanelCard}>
            <View style={styles.filterPanelHeader}>
              <View style={styles.flex}>
                <AppText variant="subtitle" style={styles.filterPanelTitle}>Bộ lọc bài đăng</AppText>
                <AppText muted variant="caption">Chọn khoảng ngày, loại media và cách sắp xếp danh sách.</AppText>
              </View>
            </View>
            <DateRangeControls
              range={range}
              onRangeChange={setRange}
              startDate={customStartDate}
              endDate={customEndDate}
              onStartDateChange={setCustomStartDate}
              onEndDateChange={setCustomEndDate}
              compact={compactHeader}
            />
            <View style={isDesktop ? styles.filterPanelGrid : styles.filterPanelStack}>
              <View style={styles.filterGroup}>
                <AppText variant="caption" muted style={styles.filterGroupLabel}>Loại bài</AppText>
                <View style={styles.filterChipRow}>
                  <SmallFilterButton label="Tất cả" detail={postInsights ? formatNumber(postInsights.summary.totalPosts) : undefined} active={postMediaKind === "all"} onPress={() => setPostMediaKind("all")} />
                  <SmallFilterButton label="1 hình" detail={postMediaBreakdown.get("single_image")} active={postMediaKind === "single_image"} onPress={() => setPostMediaKind("single_image")} />
                  <SmallFilterButton label="Nhiều hình" detail={postMediaBreakdown.get("multi_image")} active={postMediaKind === "multi_image"} onPress={() => setPostMediaKind("multi_image")} />
                  <SmallFilterButton label="Video" detail={postMediaBreakdown.get("video")} active={postMediaKind === "video"} onPress={() => setPostMediaKind("video")} />
                </View>
              </View>
              <View style={styles.filterGroup}>
                <AppText variant="caption" muted style={styles.filterGroupLabel}>Hiển thị</AppText>
                <View style={styles.filterChipRow}>
                  <SmallFilterButton label="Mới nhất" active={postSortBy === "createdAt"} onPress={() => setPostSortBy("createdAt")} />
                  <SmallFilterButton label="Nổi bật" detail="tương tác cao" active={postSortBy === "interactions"} onPress={() => setPostSortBy("interactions")} />
                </View>
              </View>
            </View>
          </Card>
          {postInsights ? (
            <>
              <View style={isDesktop ? styles.desktopGrid3 : styles.grid}>
                <MetricCard label="Bài đăng trong khoảng" value={postInsights.summary.totalPosts} note="Theo bộ lọc hiện tại" isDesktop={isDesktop} />
                <MetricCard label="Tương tác trong khoảng" value={postInsights.summary.totalInteractions} note="Like + bình luận + lưu" isDesktop={isDesktop} />
                <MetricCard
                  label="Bài nhiều tương tác nhất"
                  value={postInsights.topPosts[0] ? formatNumber((postInsights.topPosts[0].stats.likes ?? 0) + (postInsights.topPosts[0].stats.comments ?? 0) + (postInsights.topPosts[0].stats.saves ?? 0)) : 0}
                  note={postInsights.topPosts[0]?.caption || "Chưa có dữ liệu"}
                  isDesktop={isDesktop}
                />
              </View>
            </>
          ) : null}
          {posts.length ? (
            <>
              {posts.map((post) => (
                <Card key={post.id} style={[styles.itemCard, isDesktop && styles.adminPostItemCardDesktop]}>
                  <AdminPostPreview post={post} isDesktop={isDesktop} />
                  <View style={styles.headerRow}>
                    <View style={styles.flex}>
                      <AppText variant="subtitle" numberOfLines={isDesktop ? 1 : 2} style={styles.itemCardTitle}>
                        {post.caption || "(Không có caption)"}
                      </AppText>
                      <AppText muted variant="caption">
                        {post.author?.displayName || "Không rõ"} · {formatDate(post.createdAt)} · {adminPostMediaLabel(post)} · {statusLabel(post.visibility)}
                      </AppText>
                    </View>
                    <Pill label={statusLabel(post.moderationStatus)} tone={post.moderationStatus === "hidden" ? "bad" : post.moderationStatus === "review" ? "warn" : "good"} />
                  </View>
                  <AppText muted variant="caption" style={{ marginVertical: 6 }}>
                    Lượt thích {post.stats.likes} · Bình luận {post.stats.comments} · Lưu {post.stats.saves}
                  </AppText>
                  <View style={styles.actionRow}>
                    <AppButton label="Ẩn" size="sm" variant="danger" onPress={() => moderatePost(post, "hidden")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Cần xem lại" size="sm" variant="ghost" onPress={() => moderatePost(post, "review")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Khôi phục" size="sm" variant="secondary" onPress={() => moderatePost(post, "visible")} disabled={busyAction === `post-${post.id}`} />
                  </View>
                </Card>
              ))}
              <View style={styles.adminPostsFooter}>
                <AppText muted variant="caption" style={styles.adminPostsCountText}>
                  Hiển thị {formatNumber(loadedPostCount)} / {formatNumber(totalPostCount)} bài đăng
                </AppText>
                {canLoadMorePosts ? (
                  <AppButton
                    label={loadingMorePosts ? "Đang tải..." : "Tải thêm bài đăng"}
                    size="sm"
                    variant="ghost"
                    onPress={loadMorePosts}
                    disabled={loadingMorePosts}
                  />
                ) : (
                  <AppText muted variant="caption" style={styles.adminPostsDoneText}>
                    Đã hiển thị toàn bộ bài đăng phù hợp.
                  </AppText>
                )}
              </View>
            </>
          ) : (
            <EmptyState label="Chưa có bài đăng." />
          )}
        </View>
      )}

      {activeTab === "reports" && (
        <View style={{ gap: 14 }}>
          <SectionHeader title="Hàng đợi báo cáo" subtitle="Mặc định hiển thị các báo cáo đang mở." />
          {reports.length ? reports.map((report) => (
            <Card key={report.id} style={styles.itemCard}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <AppText variant="subtitle" style={styles.itemCardTitle}>
                    Đối tượng: {report.target?.displayName || "Người dùng bị báo cáo"}
                  </AppText>
                  <AppText muted variant="caption">
                    Người báo cáo: {report.actor?.displayName || "Không rõ"} · {formatDate(report.createdAt)}
                  </AppText>
                </View>
                <Pill label={statusLabel(report.status)} tone={report.status === "open" ? "warn" : "good"} />
              </View>
              <AppText style={{ marginVertical: 6 }}>{report.note || "Không có ghi chú."}</AppText>
              <View style={styles.actionRow}>
                <AppButton label="Đã xử lý" size="sm" variant="secondary" onPress={() => updateReport(report, "resolved")} disabled={busyAction === `report-${report.id}`} />
                <AppButton label="Bỏ qua" size="sm" variant="ghost" onPress={() => updateReport(report, "dismissed")} disabled={busyAction === `report-${report.id}`} />
              </View>
            </Card>
          )) : <EmptyState label="Không có báo cáo đang mở." />}
        </View>
      )}

      {activeTab === "payments" && (
        <View style={{ gap: 14 }}>
          <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
            <DetailedChart data={dashboard.charts.daily} field="payments" label="Thanh toán thành công" color={colors.yellow} />
            <DetailedChart data={dashboard.charts.daily} field="revenue" label="Doanh thu" color={colors.greenDark} />
          </View>
          <BreakdownList title="Trạng thái thanh toán" data={dashboard.breakdowns.paymentsByStatus} />
          <SectionHeader title="Giao dịch gần đây" />
          {payments.length ? payments.map((payment) => (
            <Card key={payment.id} style={styles.itemCard}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <AppText variant="subtitle" style={styles.itemCardTitle}>{payment.planId}</AppText>
                  <AppText muted variant="caption">{payment.user?.email || payment.user?.displayName || "Không rõ người dùng"}</AppText>
                </View>
                <Pill label={statusLabel(payment.status)} tone={payment.status === "PAID" ? "good" : payment.status === "PENDING" ? "warn" : "neutral"} />
              </View>
              <AppText style={{ marginVertical: 6, fontFamily: fonts.semibold }}>
                {formatCurrency(payment.amount)} <AppText muted variant="caption">· Mã đơn: {payment.orderCode}</AppText>
              </AppText>
              <AppText variant="caption" muted>
                Tạo lúc: {formatDate(payment.createdAt)} {payment.paidAt ? `· Thanh toán lúc: ${formatDate(payment.paidAt)}` : ""}
              </AppText>
            </Card>
          )) : <EmptyState label="Chưa có thanh toán." />}
        </View>
      )}

      {activeTab === "ai" && (
        <View style={{ gap: 14 }}>
          <Card style={styles.aiGenerateCard}>
            <View style={styles.aiGenerateHeader}>
              <View style={styles.flex}>
                <AppText variant="subtitle" style={{ color: colors.white, fontFamily: fonts.semibold }}>Báo cáo AI theo tài liệu KPI</AppText>
                <AppText style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 }}>
                  Hệ thống AI sẽ tự động phân tích kỹ thuật, hành vi, lưu lượng, chuyển đổi và phát hiện rủi ro từ dashboard hiện tại.
                </AppText>
              </View>
              <AppButton
                label={busyAction === "ai-report" ? "Đang tạo..." : "Tạo báo cáo"}
                size="sm"
                variant="secondary"
                onPress={generateReport}
                disabled={busyAction === "ai-report"}
              />
            </View>
          </Card>
          <ReportOutput generatedReport={generatedReport} />
        </View>
      )}
    </View>
  ) : null;

  if (isDesktop) {
    return (
      <AppScreen scroll={false} style={styles.flatScreen} noBackground>
        <View style={styles.desktopContainer}>
          <Sidebar
            navigation={navigation}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentScreen="dashboard"
            loading={loading}
            onRefresh={loadDashboard}
            handleSignOut={handleSignOut}
            busyAction={busyAction}
          />
          <View style={styles.workspace}>
            <View style={styles.desktopTopBar}>
              <View style={styles.flex}>
                <AppText variant="title" style={styles.workspaceTitle}>
                  {tabs.find((t) => t.key === activeTab)?.label}
                </AppText>
                <AppText muted variant="caption">Hệ thống giám sát và vận hành Daily Meal</AppText>
              </View>
              <View style={styles.desktopTopActions}>
                {activeTab !== "posts" ? (
                  <>
                    <DateRangeControls
                      range={range}
                      onRangeChange={setRange}
                      startDate={customStartDate}
                      endDate={customEndDate}
                      onStartDateChange={setCustomStartDate}
                      onEndDateChange={setCustomEndDate}
                      compact={compactHeader}
                    />
                    {showDashboardTimeControls ? (
                      <TimeRangeControls
                        startTime={dashboardStartTime}
                        endTime={dashboardEndTime}
                        onStartTimeChange={setDashboardStartTime}
                        onEndTimeChange={setDashboardEndTime}
                        compact={compactHeader}
                      />
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.workspaceContent}>
              <ErrorText message={error || actionError} />
              <View ref={dashboardAnimationRef}>
                {dashboardContent}
              </View>
            </ScrollView>
          </View>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} style={styles.flatScreen}>
      <View style={styles.mobileWrap}>
        <View style={styles.mobileHeader}>
          <View style={styles.flex}>
            <AppText variant="title" style={styles.mobileHeaderTitle}>Bộ quản trị</AppText>
            <AppText muted variant="caption">Hệ thống giám sát toàn diện</AppText>
          </View>
          <View style={styles.mobileHeaderActions}>
            <HeaderIconButton icon={UserIcon} onPress={() => navigation.navigate("AdminUsers")} />
            <HeaderIconButton icon={RefreshIcon} onPress={loadDashboard} disabled={loading} />
            <HeaderIconButton icon={LogoutIcon} onPress={handleSignOut} variant="danger" disabled={busyAction === "sign-out"} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileScrollContent}>
          {activeTab !== "posts" ? (
            <>
              <DateRangeControls
                range={range}
                onRangeChange={setRange}
                startDate={customStartDate}
                endDate={customEndDate}
                onStartDateChange={setCustomStartDate}
                onEndDateChange={setCustomEndDate}
                compact
              />
              {showDashboardTimeControls ? (
                <TimeRangeControls
                  startTime={dashboardStartTime}
                  endTime={dashboardEndTime}
                  onStartTimeChange={setDashboardStartTime}
                  onEndTimeChange={setDashboardEndTime}
                  compact
                />
              ) : null}
            </>
          ) : null}
          <ErrorText message={error || actionError} />
          <AdminTabs activeTab={activeTab} onChange={setActiveTab} />
          <View ref={dashboardAnimationRef}>
            {dashboardContent}
          </View>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

export function AdminUsersScreen({ navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [insightRange, setInsightRange] = useState<AdminRange>("7d");
  const [insightStartDate, setInsightStartDate] = useState("");
  const [insightEndDate, setInsightEndDate] = useState("");
  const [insightStartTime, setInsightStartTime] = useState("");
  const [insightEndTime, setInsightEndTime] = useState("");
  const [userInsights, setUserInsights] = useState<AdminUserInsights | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState<AdminPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isDesktop = width >= 992;
  const compactHeader = width < 760;
  const usersAnimationRef = useWebGsapStagger([
    users.length,
    userInsights?.summary.totalSessions ?? 0,
    insightRange,
    insightStartDate,
    insightEndDate,
    insightStartTime,
    insightEndTime
  ]);
  const userInsightParams = useMemo(
    () => ({
      ...rangeParams(insightRange, insightStartDate, insightEndDate),
      startTime: insightStartTime || undefined,
      endTime: insightEndTime || undefined
    }),
    [insightRange, insightStartDate, insightEndDate, insightStartTime, insightEndTime]
  );

  const numColumns = isDesktop && width >= 1150 ? 2 : 1;

  function mergeUsers(current: AdminUserSummary[], next: AdminUserSummary[]) {
    const map = new Map(current.map((item) => [item.id, item]));
    next.forEach((item) => map.set(item.id, item));
    return [...map.values()];
  }

  const loadUsers = useCallback(
    async ({ page = 1, append = false }: { page?: number; append?: boolean } = {}) => {
      if (!adminToken) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await api.adminUsers(adminToken, { q: query.trim() || undefined, page, limit: USER_PAGE_SIZE });
        setPagination(result.pagination);
        setUsers((current) => (append ? mergeUsers(current, result.users) : result.users));
      } catch (err: any) {
        setError(err?.message ?? "Không tải được danh sách user");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [adminToken, query]
  );

  const loadUserInsights = useCallback(async () => {
    if (!adminToken) return;
    try {
      const result = await api.adminUserInsights(adminToken, userInsightParams);
      setUserInsights(result);
    } catch (err: any) {
      setError(err?.message ?? "Không tải được báo cáo người dùng");
    }
  }, [adminToken, userInsightParams]);

  useEffect(() => {
    loadUsers({ page: 1, append: false });
  }, [loadUsers]);

  useEffect(() => {
    loadUserInsights();
  }, [loadUserInsights]);

  async function loadMore() {
    if (!pagination || pagination.page >= pagination.pages) return;
    await loadUsers({ page: pagination.page + 1, append: true });
  }

  async function loadAll() {
    if (!adminToken || !pagination || pagination.page >= pagination.pages) return;
    setLoadingAll(true);
    setError(null);
    try {
      let currentUsers = users;
      let currentPage = pagination.page;
      let currentPagination = pagination;
      while (currentPage < currentPagination.pages) {
        const nextPage = currentPage + 1;
        const result = await api.adminUsers(adminToken, { q: query.trim() || undefined, page: nextPage, limit: USER_PAGE_SIZE });
        currentUsers = mergeUsers(currentUsers, result.users);
        currentPagination = result.pagination;
        currentPage = result.pagination.page;
        setUsers(currentUsers);
        setPagination(currentPagination);
      }
    } catch (err: any) {
      setError(err?.message ?? "Không tải được toàn bộ user");
    } finally {
      setLoadingAll(false);
    }
  }

  async function togglePremium(user: AdminUserSummary) {
    if (!adminToken) return;
    setBusyUser(user.id);
    setError(null);
    try {
      const result = await api.adminSetUserPremium(adminToken, user.id, {
        isPremium: !user.isPremium,
        note: "Cập nhật từ danh sách user admin"
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...result.user } : item)));
    } catch (err: any) {
      setError(err?.message ?? "Không cập nhật được premium.");
    } finally {
      setBusyUser(null);
    }
  }

  async function handleSignOut() {
    setBusyAction("sign-out");
    try {
      await signOut();
    } catch (err: any) {
      setError(err?.message ?? "Không đăng xuất được. Vui lòng thử lại.");
    } finally {
      setBusyAction(null);
    }
  }

  const latestDailyUsage = userInsights?.dailyUsage.slice(-7) ?? [];
  const activeHours = userInsights?.hourlyActivity
    .filter((item) => item.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || b.totalDurationMs - a.totalDurationMs)
    .slice(0, 5) ?? [];
  const peakActivity = userInsights?.peakActivityWindow;

  const headerControls = (
    <View style={styles.usersHeaderControls}>
      <Card style={styles.filterPanelCard}>
        <View style={styles.filterPanelHeader}>
          <View style={styles.flex}>
            <AppText variant="subtitle" style={styles.filterPanelTitle}>Báo cáo người dùng</AppText>
            <AppText muted variant="caption">Theo dõi thời lượng phiên và user hoạt động tiêu biểu.</AppText>
          </View>
        </View>
        <DateRangeControls
          range={insightRange}
          onRangeChange={setInsightRange}
          startDate={insightStartDate}
          endDate={insightEndDate}
          onStartDateChange={setInsightStartDate}
          onEndDateChange={setInsightEndDate}
          compact={compactHeader}
        />
        <TimeRangeControls
          startTime={insightStartTime}
          endTime={insightEndTime}
          onStartTimeChange={setInsightStartTime}
          onEndTimeChange={setInsightEndTime}
          compact={compactHeader}
        />
      </Card>
      {userInsights ? (
        <>
          <View style={isDesktop ? styles.desktopGrid4 : styles.grid}>
            <MetricCard label="Phiên trung bình" value={formatDuration(userInsights.summary.averageSessionDurationMs)} note={`${formatNumber(userInsights.summary.totalSessions)} phiên`} isDesktop={isDesktop} />
            <MetricCard label="Tổng thời gian dùng" value={formatDuration(userInsights.summary.totalDurationMs)} note="Tổng thời lượng phiên" isDesktop={isDesktop} />
            <MetricCard label="Người dùng trong khoảng" value={userInsights.summary.activeUsers} note={`${formatNumber(userInsights.summary.returningUsers)} user quay lại`} isDesktop={isDesktop} />
            <MetricCard label="Khung giờ cao điểm" value={peakActivity && peakActivity.sessions > 0 ? formatHourLabel(peakActivity.hour) : "--"} note={peakActivity && peakActivity.sessions > 0 ? `${formatNumber(peakActivity.sessions)} phiên · ${formatDuration(peakActivity.totalDurationMs)}` : "Chưa có dữ liệu"} isDesktop={isDesktop} />
          </View>
          <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
            <AdminSeriesChart
              title="Thời gian dùng mỗi ngày"
              subtitle="Tổng thời lượng phiên của users theo từng ngày."
              data={latestDailyUsage.map((item) => ({
                value: Math.round(item.totalDurationMs / 60000),
                label: item.date.slice(5)
              }))}
              color={colors.greenDark}
              type="area"
            />
            <AdminSeriesChart
              title="Phiên hoạt động theo giờ"
              subtitle="Số phiên user active trong từng khung giờ."
              data={userInsights.hourlyActivity.map((item) => ({
                value: item.sessions,
                label: item.label
              }))}
              color={colors.blue}
              type="bar"
            />
          </View>
          <Card style={styles.reportMiniCard}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <AppText variant="subtitle" style={styles.reportMiniTitle}>User hoạt động tiêu biểu</AppText>
                <AppText muted variant="caption">Xếp hạng bằng thời lượng phiên, số phiên, bài đăng và tương tác.</AppText>
              </View>
            </View>
            <View style={styles.detailSectionList}>
              {userInsights.topUsers.length ? userInsights.topUsers.slice(0, 5).map((item, index) => (
                <View key={item.id} testID="admin-animate-row" style={styles.activeUserRow}>
                  <View style={styles.activeUserRank}>
                    <AppText style={styles.activeUserRankText}>{index + 1}</AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="button" style={styles.detailItemTitle}>{item.displayName}</AppText>
                    <AppText muted variant="caption">
                      {formatDuration(item.averageSessionDurationMs)} / phiên · {formatNumber(item.sessions)} phiên · {formatNumber(item.posts)} bài · {formatNumber(item.interactions)} tương tác
                    </AppText>
                  </View>
                  <Pill label={item.returning ? "Quay lại" : "Mới"} tone={item.returning ? "good" : "neutral"} />
                </View>
              )) : <AppText muted variant="caption">Chưa có dữ liệu hoạt động trong khoảng này.</AppText>}
            </View>
          </Card>
        </>
      ) : null}
      <View style={[styles.searchRow, compactHeader && styles.searchRowCompact]}>
        <View style={styles.searchInput}>
          <TextField label="Từ khóa tìm kiếm" value={query} onChangeText={setQuery} placeholder="Tên, email hoặc SĐT..." />
        </View>
        <AppButton label="Tìm kiếm" size="sm" style={styles.searchButton} onPress={() => loadUsers({ page: 1, append: false })} disabled={loading} />
      </View>
      <ErrorText message={error} />
      {pagination ? (
        <View style={styles.usersCountRow}>
          <UserIcon size={16} color={colors.greenDark} />
          <AppText muted variant="caption" style={{ fontFamily: fonts.semibold }}>
            Đã tải {formatNumber(users.length)} / {formatNumber(pagination.total)} người dùng
          </AppText>
        </View>
      ) : null}
    </View>
  );

  const footerControls = (
    <View style={styles.listFooter}>
      {loading || loadingMore || loadingAll ? <ActivityIndicator color={colors.greenDark} /> : null}
      {pagination && pagination.page < pagination.pages ? (
        <View style={styles.actionRow}>
          <AppButton label={loadingMore ? "Đang tải..." : "Tải thêm"} size="sm" variant="ghost" onPress={loadMore} disabled={loadingMore || loadingAll} />
          <AppButton label={loadingAll ? "Đang tải tất cả..." : "Tải tất cả"} size="sm" onPress={loadAll} disabled={loadingMore || loadingAll} />
        </View>
      ) : pagination ? (
        <AppText muted variant="caption" style={{ textAlign: "center", marginVertical: 12 }}>Đã tải toàn bộ người dùng phù hợp.</AppText>
      ) : null}
    </View>
  );

  function renderUserItem({ item }: { item: AdminUserSummary }) {
    const initials = item.displayName ? item.displayName.slice(0, 2).toUpperCase() : "US";
    return (
      <Pressable testID="admin-animate-card" style={styles.userCard} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })}>
        <View style={styles.userCardTop}>
          <View style={styles.avatarCircle}>
            <AppText style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="subtitle" style={styles.userCardName} numberOfLines={1}>{item.displayName}</AppText>
            <AppText muted variant="caption" numberOfLines={1}>{item.email || item.phone || item.id}</AppText>
          </View>
          <Pill label={item.isPremium ? "Premium" : "Miễn phí"} tone={item.isPremium ? "good" : "neutral"} />
        </View>
        <View style={styles.userCardStats}>
          <View style={styles.userStatMini}>
            <PostsIcon size={12} color={colors.muted} />
            <AppText variant="caption" muted>{item.stats.posts} bài</AppText>
          </View>
          <View style={styles.userStatMini}>
            <UserIcon size={12} color={colors.muted} />
            <AppText variant="caption" muted>{item.stats.followers} fl</AppText>
          </View>
          <View style={styles.userStatMini}>
            <AlertIcon size={12} color={item.stats.reports > 0 ? colors.red : colors.muted} />
            <AppText variant="caption" style={{ color: item.stats.reports > 0 ? colors.red : colors.muted }}>{item.stats.reports} báo cáo</AppText>
          </View>
        </View>
        <View style={styles.userCardActions}>
          <AppButton label={item.isPremium ? "Hủy Prem" : "Bật Prem"} size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => togglePremium(item)} disabled={busyUser === item.id} />
          <AppButton label="Chi tiết" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })} />
        </View>
      </Pressable>
    );
  }

  if (isDesktop) {
    return (
      <AppScreen scroll={false} style={styles.flatScreen} noBackground>
        <View style={styles.desktopContainer}>
          <Sidebar
            navigation={navigation}
            currentScreen="users"
            loading={loading}
            onRefresh={() => loadUsers({ page: 1, append: false })}
            handleSignOut={handleSignOut}
            busyAction={busyAction}
          />
          <View style={styles.workspace}>
            <View style={styles.desktopTopBar}>
              <View style={styles.flex}>
                <AppText variant="title" style={styles.workspaceTitle}>Quản lý người dùng</AppText>
                <AppText muted variant="caption">Tìm kiếm, cập nhật tài khoản và phân quyền Premium thủ công.</AppText>
              </View>
              <View style={styles.desktopTopActions}>
                <HeaderIconButton icon={CategoryIcon} onPress={() => navigation.navigate("AdminDashboard")} />
              </View>
            </View>

            <View ref={usersAnimationRef} style={styles.workspaceUsersContent}>
              <FlatList
                key={numColumns}
                numColumns={numColumns}
                style={styles.usersFlatList}
                contentContainerStyle={styles.usersDesktopListContent}
                columnWrapperStyle={numColumns > 1 ? { gap: 16, marginBottom: 16 } : undefined}
                data={users}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={headerControls}
                ListFooterComponent={footerControls}
                renderItem={renderUserItem}
                ListEmptyComponent={!loading ? <EmptyState label="Không có người dùng phù hợp." /> : null}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} style={styles.flatScreen}>
      <View style={styles.mobileWrap}>
        <View style={styles.mobileHeader}>
          <View style={styles.flex}>
            <AppText variant="title" style={styles.mobileHeaderTitle}>Người dùng</AppText>
            <AppText muted variant="caption">Danh sách tài khoản hệ thống</AppText>
          </View>
          <View style={styles.mobileHeaderActions}>
            <HeaderIconButton icon={CategoryIcon} onPress={() => navigation.navigate("AdminDashboard")} />
          </View>
        </View>

        <FlatList
          key="m"
          data={users}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={headerControls}
          ListFooterComponent={footerControls}
          renderItem={renderUserItem}
          contentContainerStyle={styles.mobileScrollContent}
          ListEmptyComponent={!loading ? <EmptyState label="Không có người dùng phù hợp." /> : null}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </AppScreen>
  );
}

export function AdminUserDetailScreen({ route, navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isDesktop = width >= 992;

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.adminUser(adminToken, route.params.id);
      setUser(result.user);
    } catch (err: any) {
      setError(err?.message ?? "Không tải được chi tiết user");
    } finally {
      setLoading(false);
    }
  }, [adminToken, route.params.id]);

  async function togglePremium() {
    if (!adminToken || !user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.adminSetUserPremium(adminToken, user.id, {
        isPremium: !user.isPremium,
        note: "Cập nhật từ chi tiết user admin"
      });
      setUser((current) => (current ? { ...current, ...result.user } : current));
    } catch (err: any) {
      setError(err?.message ?? "Không cập nhật được premium.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusyAction("sign-out");
    try {
      await signOut();
    } catch (err: any) {
      setError(err?.message ?? "Không đăng xuất được. Vui lòng thử lại.");
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !user) {
    return (
      <AppScreen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.greenDark} />
          <ErrorText message={error} />
        </View>
      </AppScreen>
    );
  }

  const userInitials = user.displayName ? user.displayName.slice(0, 2).toUpperCase() : "US";

  const userDetailContent = (
    <View style={styles.detailContainer}>
      <ErrorText message={error} />

      {/* Main Profile Info Card */}
      <Card style={styles.profileHeaderCard}>
        <View style={styles.profileMetaRow}>
          <View style={styles.profileAvatarCircle}>
            <AppText style={styles.profileAvatarText}>{userInitials}</AppText>
          </View>
          <View style={styles.flex}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <AppText variant="title" style={styles.profileDisplayName}>{user.displayName}</AppText>
              <Pill label={user.isPremium ? "Premium" : "Miễn phí"} tone={user.isPremium ? "good" : "neutral"} />
            </View>
            <AppText muted style={{ marginTop: 2 }}>ID: {user.id}</AppText>
            <AppText muted variant="caption" style={{ marginTop: 2 }}>
              Liên hệ: {user.email || "Chưa cung cấp email"} {user.phone ? `· ${user.phone}` : ""}
            </AppText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.profileInfoDetails}>
          <AppText style={styles.profileBioText}>
            <AppText variant="button">Tiểu sử: </AppText>
            {user.bio || "(Chưa có tiểu sử)"}
          </AppText>
          <AppText style={styles.profileBioText}>
            <AppText variant="button">Sở thích ẩm thực: </AppText>
            {user.preferences?.interests?.join(", ") || "Chưa cập nhật"}
          </AppText>
          <AppText style={styles.profileBioText}>
            <AppText variant="button">Kiểu ăn uống: </AppText>
            {user.preferences?.eatingStyles?.join(", ") || "Chưa cập nhật"}
          </AppText>
          <AppText variant="caption" muted style={{ marginTop: 4 }}>
            Tạo tài khoản: {formatDate(user.createdAt)} · Cập nhật gần nhất: {formatDate(user.updatedAt)}
          </AppText>
        </View>

        <View style={styles.divider} />

        <View style={styles.profileActions}>
          <AppText variant="caption" muted style={{ flex: 1, marginRight: 12 }}>
            Chuyển trạng thái Premium để kích hoạt các đặc quyền AI phân tích món ăn và đề xuất dinh dưỡng nâng cao.
          </AppText>
          <AppButton
            label={user.isPremium ? "Tắt Premium" : "Kích hoạt Premium"}
            size="sm"
            variant={user.isPremium ? "ghost" : "secondary"}
            onPress={togglePremium}
            disabled={busy}
          />
        </View>
      </Card>

      {/* Stats Cards */}
      <View style={isDesktop ? styles.desktopGrid4 : styles.grid}>
        <MetricCard label="Bài đăng" value={user.stats.posts} isDesktop={isDesktop} />
        <MetricCard label="Người theo dõi" value={user.stats.followers} isDesktop={isDesktop} />
        <MetricCard label="Đang theo dõi" value={user.stats.following} isDesktop={isDesktop} />
        <MetricCard label="Báo cáo" value={user.stats.reports} isDesktop={isDesktop} />
      </View>

      {/* Side-by-side or stacked detail lists */}
      <View style={isDesktop ? styles.twoColumn : styles.stackColumn}>
        {/* Recent Posts */}
        <Card style={styles.detailSectionCard}>
          <AppText variant="subtitle" style={styles.detailSectionTitle}>
            <PostsIcon size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
            Bài đăng gần đây
          </AppText>
          <View style={styles.detailSectionList}>
            {user.recentPosts.length ? (
              user.recentPosts.map((post) => (
                <View key={post.id} style={styles.listLine}>
                  <AppText style={styles.detailItemTitle} numberOfLines={1}>{post.caption || "(Không có caption)"}</AppText>
                  <View style={styles.detailItemMeta}>
                    <Pill label={statusLabel(post.moderationStatus)} tone={post.moderationStatus === "hidden" ? "bad" : post.moderationStatus === "review" ? "warn" : "good"} />
                    <AppText variant="caption" muted>
                      {statusLabel(post.visibility)} · {formatDate(post.createdAt)}
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <AppText muted variant="caption" style={{ padding: 12 }}>Không có bài đăng.</AppText>
            )}
          </View>
        </Card>

        {/* Attention Interactions */}
        <Card style={styles.detailSectionCard}>
          <AppText variant="subtitle" style={styles.detailSectionTitle}>
            <AlertIcon size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
            Tương tác cần chú ý
          </AppText>
          <View style={styles.detailSectionList}>
            {user.interactions.length ? (
              user.interactions.map((interaction) => (
                <View key={interaction.id} style={styles.listLine}>
                  <View style={styles.headerRow}>
                    <AppText style={styles.detailItemTitle}>{statusLabel(interaction.type)}: {interaction.note || "-"}</AppText>
                    <Pill label={statusLabel(interaction.status)} tone={interaction.status === "resolved" ? "good" : interaction.status === "dismissed" ? "neutral" : "warn"} />
                  </View>
                  <AppText variant="caption" muted style={{ marginTop: 4 }}>
                    {formatDate(interaction.createdAt)} {interaction.adminNote ? `· Ghi chú: ${interaction.adminNote}` : ""}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText muted variant="caption" style={{ padding: 12 }}>Không có dữ liệu tương tác bất thường.</AppText>
            )}
          </View>
        </Card>
      </View>

      {/* User operations Audit Log */}
      <Card style={styles.itemCard}>
        <AppText variant="subtitle" style={styles.detailSectionTitle}>
          <ClockIcon size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
          Lịch sử thao tác tài khoản
        </AppText>
        <View style={{ gap: 8, marginTop: 10 }}>
          {user.audit?.length ? (
            user.audit.map((item) => (
              <View key={item.id} style={styles.auditLogLine}>
                <View style={styles.auditLogDot} />
                <View style={styles.flex}>
                  <AppText variant="body" style={{ fontFamily: fonts.semibold }}>{item.action}</AppText>
                  <AppText variant="caption" muted>{formatDate(item.createdAt)} {item.note ? `· ${item.note}` : ""}</AppText>
                </View>
              </View>
            ))
          ) : (
            <AppText muted variant="caption" style={{ padding: 12 }}>Chưa có bản ghi hoạt động.</AppText>
          )}
        </View>
      </Card>
    </View>
  );

  if (isDesktop) {
    return (
      <AppScreen scroll={false} style={styles.flatScreen} noBackground>
        <View style={styles.desktopContainer}>
          <Sidebar
            navigation={navigation}
            currentScreen="user-detail"
            loading={loading}
            onRefresh={load}
            handleSignOut={handleSignOut}
            busyAction={busyAction}
          />
          <View style={styles.workspace}>
            <View style={styles.desktopTopBar}>
              <View style={styles.flex}>
                <AppText variant="title" style={styles.workspaceTitle}>Hồ sơ chi tiết</AppText>
                <AppText muted variant="caption">Xem thông tin toàn diện và nhật ký thao tác của người dùng.</AppText>
              </View>
              <View style={styles.desktopTopActions}>
                <HeaderIconButton icon={ArrowLeftIcon} onPress={() => navigation.goBack()} />
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.workspaceContent}>
              {userDetailContent}
            </ScrollView>
          </View>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} style={styles.flatScreen}>
      <View style={styles.mobileWrap}>
        <View style={styles.mobileHeader}>
          <View style={styles.flex}>
            <AppText variant="title" style={styles.mobileHeaderTitle}>Chi tiết User</AppText>
            <AppText muted variant="caption">Hồ sơ người dùng chi tiết</AppText>
          </View>
          <View style={styles.mobileHeaderActions}>
            <HeaderIconButton icon={ArrowLeftIcon} onPress={() => navigation.goBack()} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileScrollContent}>
          {userDetailContent}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // Global & Login styles
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  flatScreen: { padding: 0 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },

  // Cards layout base
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    gap: 8,
    // Soft shadow for Web/iOS
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 1
  },
  emptyStateCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderStyle: "dashed"
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    borderColor: "#FFCDD2",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginVertical: 4
  },
  error: { color: colors.red, fontSize: 13, flex: 1 },

  // Responsive Grid layouts
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  desktopGrid3: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  desktopGrid4: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  twoColumn: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  stackColumn: { flexDirection: "column", gap: 16 },

  // Metric Cards
  metricCard: {
    minWidth: 120,
    flexGrow: 1,
    flexShrink: 1
  },
  metricCardDesktop: {
    flexBasis: 210,
    maxWidth: "100%"
  },
  metricCardMobile: {
    width: "47%"
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  metricLabel: {
    flex: 1,
    fontSize: 11,
    marginRight: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.semibold
  },
  metricIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(79, 111, 61, 0.07)",
    alignItems: "center",
    justifyContent: "center"
  },
  metricValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.ink
  },
  metricNote: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2
  },

  // Pill badges
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 11,
    fontFamily: fonts.semibold,
    overflow: "hidden"
  },
  pillGood: { backgroundColor: "#E8F5E9", color: "#2E7D32" },
  pillWarn: { backgroundColor: "#FFF3E0", color: "#E65100" },
  pillBad: { backgroundColor: "#FFEBEE", color: "#C62828" },
  pillNeutral: { backgroundColor: "#F5F5F5", color: "#616161" },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 2
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink
  },

  // Range Selector
  rangeSelector: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  rangeButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  rangeButtonActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  rangeText: { color: colors.ink, fontFamily: fonts.medium },
  rangeTextActive: { color: colors.white },
  dateFilterPanel: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    flexShrink: 1,
    maxWidth: "100%"
  },
  dateFilterPanelCompact: {
    alignItems: "stretch"
  },
  timeFilterPanel: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)"
  },
  timeFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44
  },
  customDateRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    flexWrap: "wrap",
    flexShrink: 1
  },
  customDateRowCompact: {
    width: "100%",
    flexWrap: "wrap"
  },
  datePickerField: {
    minWidth: 150,
    flexGrow: 1,
    gap: 6
  },
  datePickerLabel: {
    fontFamily: fonts.medium
  },
  webDateInputShell: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  clearDateButton: {
    minHeight: 38,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvasStrong
  },
  clearDateText: {
    color: colors.ink,
    fontFamily: fonts.semibold
  },
  filterPanelCard: {
    gap: 14
  },
  filterPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  filterPanelTitle: {
    fontFamily: fonts.bold,
    color: colors.ink
  },
  filterGroup: {
    gap: 7,
    flex: 1,
    minWidth: 260
  },
  filterPanelGrid: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  filterPanelStack: { gap: 12 },
  filterGroupLabel: {
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  filterChipText: {
    color: colors.ink,
    fontFamily: fonts.semibold
  },
  filterChipDetail: {
    color: colors.muted,
    fontFamily: fonts.medium
  },
  filterChipTextActive: {
    color: colors.white
  },

  // Mobile Tabs
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20
  },
  tabActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  tabText: { color: colors.ink, fontFamily: fonts.medium },
  tabTextActive: { color: colors.white },

  // Detailed Charts
  chartCard: { minHeight: 260, flex: 1, minWidth: 0 },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    paddingBottom: 10,
    marginBottom: 10
  },
  chartTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  chartStatsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  chartStatBox: { alignItems: "flex-start" },
  chartStatTitle: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.3 },
  chartStatValue: { fontSize: 12, fontFamily: fonts.bold, color: colors.ink },
  chartStatDate: { fontSize: 8, color: colors.muted },
  chartBody: { flex: 1, minHeight: 150, position: "relative", justifyContent: "flex-end", paddingTop: 14 },
  chartGrid: { ...StyleSheet.absoluteFillObject, top: 14, bottom: 20, zIndex: 1 },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 34,
    height: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderStyle: "dashed",
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  chartGridLabel: { position: "absolute", top: -11, right: -34, width: 30, textAlign: "right", fontSize: 8, color: colors.muted },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 6, minHeight: 120, paddingRight: 34, zIndex: 2, position: "relative" },
  barColumn: { flex: 1, alignItems: "center" },
  chartBarValue: { fontSize: 8, color: colors.muted, height: 10, marginBottom: 2, fontFamily: fonts.medium },
  barTrack: { height: 90, width: "100%", maxWidth: 22, borderRadius: 4, backgroundColor: "rgba(25,27,31,0.05)", justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartDateLabel: { fontSize: 8, color: colors.muted, marginTop: 4 },
  chartEmptyState: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  chartEmptyTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold
  },

  // Breakdowns
  breakdownCard: { minHeight: 200, flex: 1, minWidth: 0 },
  breakdownTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  breakdownContainer: { gap: 10, marginTop: 6 },
  breakdownRow: { gap: 4 },
  breakdownHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: 13, color: colors.ink },
  breakdownValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  breakdownBarTrack: { height: 6, width: "100%", borderRadius: 3, backgroundColor: colors.canvasStrong, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 3 },

  // AI Report Output
  reportCard: { gap: 16 },
  reportHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  reportHeaderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenDark, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  reportDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
  reportSummaryPanel: { backgroundColor: "#F6F8F4", borderWidth: 1, borderColor: "rgba(82,106,69,0.14)", borderRadius: 8, padding: 14, gap: 8 },
  reportSummaryTitle: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 13 },
  reportSectionStack: { gap: 14 },
  reportSectionCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14, gap: 14, backgroundColor: colors.white },
  reportSectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  reportSectionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  reportSectionTitle: { fontSize: 15, color: colors.ink, fontFamily: fonts.bold, letterSpacing: 0 },
  reportObjective: { lineHeight: 18, marginTop: 2 },
  reportMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportMetricCard: { flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", backgroundColor: colors.canvasStrong, borderRadius: 8, padding: 12, gap: 5 },
  reportMetricName: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11 },
  reportMetricValue: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 17 },
  reportMetricAssessment: { color: colors.ink, fontFamily: fonts.semibold, lineHeight: 17 },
  reportMetricMeaning: { lineHeight: 17 },
  reportSubBlock: { gap: 8 },
  reportSubTitle: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 12 },
  reportList: { gap: 7 },
  reportItemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  reportBullet: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(82,106,69,0.12)", color: colors.greenDark, textAlign: "center", fontSize: 11, lineHeight: 18, fontFamily: fonts.bold },
  reportItemText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
  reportConclusionBox: { backgroundColor: "rgba(25,27,31,0.04)", borderLeftWidth: 3, borderLeftColor: colors.greenDark, padding: 12, gap: 6, borderRadius: 6 },
  reportConclusionText: { color: colors.ink, lineHeight: 20, fontFamily: fonts.medium },
  reportBottomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reportBottomPanel: { flexGrow: 1, flexBasis: 260, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, gap: 8, backgroundColor: colors.surface },
  reportMiniCard: { minHeight: 144 },
  insightPanelCard: { flex: 1, minWidth: 0, minHeight: 150 },
  reportMiniTitle: { fontFamily: fonts.bold, color: colors.ink },
  analyticsHeatmapCard: { gap: 14 },
  heatmapWrap: { gap: 5, paddingVertical: 4, paddingRight: 8 },
  heatmapHourRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heatmapRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heatmapDayLabel: { width: 42, color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
  heatmapHourLabel: { width: 18, textAlign: "center", color: colors.muted, fontSize: 8 },
  heatmapCell: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "rgba(82,106,69,0.08)" },
  usageReportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)"
  },
  usageReportValue: {
    color: colors.greenDark,
    fontFamily: fonts.bold
  },
  activeUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)"
  },
  activeUserRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center"
  },
  activeUserRankText: { color: colors.white, fontFamily: fonts.bold },

  // Header icon buttons (Mobile/Desktop actions)
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  headerIconBtnDanger: { backgroundColor: colors.red, borderColor: colors.red },
  headerIconBtnSuccess: { backgroundColor: colors.green, borderColor: colors.green },
  headerIconBtnPrimary: { backgroundColor: colors.black, borderColor: colors.black },

  // Desktop layout (Sidebar + Workspace)
  desktopContainer: { flexDirection: "row", flex: 1, minHeight: "100%", backgroundColor: colors.canvas },
  sidebar: {
    width: 250,
    backgroundColor: "#191B1F",
    padding: 16,
    gap: 12,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    height: "100%"
  },
  sidebarBrand: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 6 },
  brandIconContainer: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.greenDark, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  brandSubtitle: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  sidebarDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 8 },
  sidebarGroupTitle: { color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, paddingLeft: 8 },
  sidebarNav: { gap: 3 },
  sidebarNavItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  sidebarNavItemActive: { backgroundColor: colors.greenDark },
  sidebarNavLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: fonts.medium },
  sidebarNavLabelActive: { color: colors.white, fontFamily: fonts.semibold },
  sidebarFooter: { gap: 6, marginTop: "auto", paddingBottom: 6 },
  sidebarActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  sidebarActionText: { color: "rgba(255,255,255,0.8)" },
  sidebarActionBtnDanger: { backgroundColor: colors.red, borderColor: colors.red },
  sidebarActionTextDanger: { color: colors.white, fontFamily: fonts.semibold },

  workspace: { flex: 1, backgroundColor: colors.canvas },
  workspaceTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  workspaceContent: { padding: 20, gap: 16 },
  workspaceBody: { gap: 16 },
  desktopTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  desktopTopActions: { flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap" },

  // Mobile layout styles
  mobileWrap: { flex: 1, backgroundColor: colors.canvas },
  mobileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  mobileHeaderTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  mobileHeaderActions: { flexDirection: "row", gap: 6 },
  mobileScrollContent: { padding: 16, gap: 14, paddingBottom: 28 },

  // Item List Cards (Posts, Reports, Payments)
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6
  },
  adminPostItemCardDesktop: {
    minHeight: 128,
    paddingLeft: 160
  },
  adminPostPreview: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  adminPostPreviewDesktop: {
    position: "absolute",
    left: 16,
    top: 16,
    width: 128,
    height: 96
  },
  adminPostPreviewMobile: {
    width: "100%",
    aspectRatio: 16 / 9,
    marginBottom: 6
  },
  adminPostPreviewImage: {
    width: "100%",
    height: "100%"
  },
  adminPostPreviewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.canvasStrong
  },
  adminPostPreviewText: {
    fontFamily: fonts.semibold
  },
  adminPostImageCountBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    minWidth: 30,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)"
  },
  adminPostImageCountText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 11
  },
  itemCardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },

  // Audit Logs (Timeline style)
  auditList: { gap: 10 },
  auditItem: { flexDirection: "row", gap: 12 },
  auditIconCol: { alignItems: "center" },
  auditIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(79,111,61,0.08)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  auditLine: { width: 1, flex: 1, backgroundColor: colors.line, marginVertical: 2 },
  auditContentCol: { flex: 1, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  auditHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  auditActionText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  auditDetails: { fontSize: 12, color: colors.muted },

  // Users Management Screen
  workspaceUsersContent: { flex: 1, padding: 20, minHeight: 0 },
  usersFlatList: { flex: 1, minHeight: 0 },
  usersDesktopListContent: { gap: 12, paddingBottom: 20 },
  usersHeaderControls: { gap: 12, paddingBottom: 4 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", flexWrap: "wrap" },
  searchRowCompact: { flexDirection: "column", alignItems: "stretch" },
  searchInput: { flex: 1, width: "100%" },
  searchButton: { minHeight: 46 },
  usersCountRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  listFooter: { paddingVertical: 12, gap: 8 },
  adminPostsFooter: { paddingTop: 8, gap: 8, alignItems: "center" },
  adminPostsCountText: { textAlign: "center", fontFamily: fonts.semibold },
  adminPostsDoneText: { textAlign: "center" },

  // User Card in list
  userCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    flex: 1,
    minWidth: 150
  },
  userCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  userCardName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  userCardStats: { flexDirection: "row", gap: 12, paddingLeft: 4, marginVertical: 2 },
  userStatMini: { flexDirection: "row", alignItems: "center", gap: 4 },
  userCardActions: { flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" },

  // User Details Screen
  detailContainer: { gap: 16 },
  profileHeaderCard: { padding: 20 },
  profileMetaRow: { flexDirection: "row", gap: 16, alignItems: "center", flexWrap: "wrap" },
  profileAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center"
  },
  profileAvatarText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  profileDisplayName: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  profileInfoDetails: { gap: 8 },
  profileBioText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  profileActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 },

  detailSectionCard: { minHeight: 220, gap: 10, flex: 1, minWidth: 0 },
  detailSectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, flexDirection: "row", alignItems: "center" },
  detailSectionList: { gap: 8 },
  listLine: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)", gap: 4 },
  detailItemTitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  detailItemMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },

  auditLogLine: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 4 },
  auditLogDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.greenDark, marginTop: 7 },

  // AI screen details
  aiGenerateCard: {
    backgroundColor: "#191B1F",
    borderColor: "#2B2D31",
    borderWidth: 1,
    borderRadius: 12,
    padding: 20
  },
  aiGenerateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 },

  // Login visual details
  loginWrap: { gap: 16, justifyContent: "center", alignItems: "center", minHeight: "100%", backgroundColor: colors.canvas, padding: 20 },
  loginCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 30,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  loginLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  loginTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink, textAlign: "center" },
  loginSubtitle: { textAlign: "center", fontSize: 13, paddingHorizontal: 10 }
});
