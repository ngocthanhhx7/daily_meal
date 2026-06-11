import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View, ScrollView, Image } from "react-native";
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
  AdminPayment,
  AdminPagination,
  AdminPostSummary,
  AdminReport,
  AdminReportItem,
  AdminUserDetail,
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

type AdminTab = "overview" | "analytics" | "posts" | "reports" | "payments" | "ai";
type AdminRange = "1d" | "7d" | "all";

const USER_PAGE_SIZE = 50;

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "analytics", label: "KPI" },
  { key: "posts", label: "Bài đăng" },
  { key: "reports", label: "Báo cáo" },
  { key: "payments", label: "Thanh toán" },
  { key: "ai", label: "Báo cáo AI" }
];

const tabIcons: Record<AdminTab, React.ComponentType<{ size?: number; color?: string; style?: any }>> = {
  overview: CategoryIcon,
  analytics: KPIIcon,
  posts: PostsIcon,
  reports: ReportsIcon,
  payments: PaymentsIcon,
  ai: AiIcon
};

const rangeOptions: Array<{ key: AdminRange; label: string }> = [
  { key: "1d", label: "1 ngày" },
  { key: "7d", label: "7 ngày" },
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
  "Tỷ lệ bấm bảng tin": CompassIcon,
  "Phản hồi API": CompassIcon,
  "Tải ảnh": PostsIcon,
  "Lỗi runtime": AlertIcon,
  "Chuyển đổi creator": KPIIcon,
  "Hoàn tất đăng bài": ReportsIcon,
  "Hoàn tất AI món ăn": KPIIcon,
  "Thanh toán premium": PaymentsIcon
};

function rangeParams(range: AdminRange) {
  return { range };
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
    report: "Báo cáo",
    restrict: "Hạn chế",
    block: "Chặn"
  };
  return value ? labels[value] ?? value : "-";
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function MetricCard({ label, value, note, isDesktop }: { label: string; value: string | number; note?: string; isDesktop?: boolean }) {
  const Icon = metricVectorIcons[label] || KPIIcon;
  return (
    <Card style={[styles.metricCard, { width: isDesktop ? "31%" : "47%" }]}>
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
  const max = Math.max(1, ...values);
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

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.chartTitle}>{label}</AppText>
          <AppText variant="caption" muted>{isDesktop ? 14 : 7} mốc gần nhất</AppText>
        </View>
        <View style={styles.chartStatsRow}>
          <View style={styles.chartStatBox}>
            <AppText variant="caption" style={styles.chartStatTitle} muted>Tổng cộng</AppText>
            <AppText variant="button" style={[styles.chartStatValue, { color }]}>{formatFullValue(total)}</AppText>
          </View>
          <View style={styles.chartStatBox}>
            <AppText variant="caption" style={styles.chartStatTitle} muted>Trung bình</AppText>
            <AppText variant="button" style={styles.chartStatValue}>{formatFullValue(avg)}</AppText>
          </View>
          <View style={styles.chartStatBox}>
            <AppText variant="caption" style={styles.chartStatTitle} muted>Đỉnh cao</AppText>
            <AppText variant="button" style={[styles.chartStatValue, { color: colors.red }]}>{formatFullValue(peak)}</AppText>
            {peakDate ? <AppText variant="caption" style={styles.chartStatDate} muted>{peakDate.slice(5)}</AppText> : null}
          </View>
        </View>
      </View>

      <View style={styles.chartBody}>
        <View style={styles.chartGrid}>
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <View key={ratio} style={[styles.chartGridLine, { bottom: `${ratio * 100}%` }]}>
              <AppText variant="caption" style={styles.chartGridLabel} muted>
                {formatVal(max * ratio)}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.barChart}>
          {compactData.map((item) => {
            const value = Number(item[field] ?? 0);
            const heightPercent = (value / max) * 100;
            return (
              <View key={`${field}-${item.date}`} style={styles.barColumn}>
                <AppText variant="caption" style={styles.chartBarValue} numberOfLines={1}>
                  {value > 0 ? formatVal(value) : ""}
                </AppText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(4, heightPercent)}%`, backgroundColor: color }]} />
                </View>
                <AppText variant="caption" style={styles.chartDateLabel} muted numberOfLines={1}>
                  {item.date.slice(5)}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
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

function ReportOutput({ generatedReport }: { generatedReport: AdminReport | null }) {
  if (!generatedReport) {
    return <EmptyState label="Bấm tạo báo cáo để AI phân tích trên dữ liệu dashboard hiện tại." />;
  }

  const sections: Array<[string, string[]]> = [
    ["Tóm tắt", generatedReport.report.executiveSummary],
    ["Kỹ thuật", generatedReport.report.technical],
    ["Hành vi", generatedReport.report.behavioral],
    ["Lưu lượng", generatedReport.report.traffic],
    ["Chuyển đổi", generatedReport.report.conversion],
    ["Bất thường", generatedReport.report.anomalies],
    ["Ưu tiên", generatedReport.report.priorityActions],
    ["Rủi ro", generatedReport.report.risks]
  ];

  return (
    <Card style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <AiIcon size={20} color={colors.greenDark} />
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.reportTitle}>{generatedReport.report.title}</AppText>
          <AppText variant="caption" muted>
            Tạo lúc {formatDate(generatedReport.generatedAt)} · {formatDate(generatedReport.range.start)} - {formatDate(generatedReport.range.end)}
          </AppText>
        </View>
      </View>
      <View style={styles.reportDivider} />
      {sections.map(([title, items]) => (
        <View key={title} style={styles.reportSection}>
          <AppText variant="button" style={styles.reportSectionTitle}>{title}</AppText>
          {items.length ? (
            items.map((item, index) => (
              <View key={`${title}-${index}`} style={styles.reportItemRow}>
                <AppText style={styles.reportBullet}>•</AppText>
                <AppText style={styles.reportItemText}>{item}</AppText>
              </View>
            ))
          ) : (
            <AppText muted variant="caption" style={{ paddingLeft: 12 }}>Không có nhận định.</AppText>
          )}
        </View>
      ))}
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
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [posts, setPosts] = useState<AdminPostSummary[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [generatedReport, setGeneratedReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDesktop = width >= 992;
  const compactHeader = width < 760;

  const loadDashboard = useCallback(async () => {
    if (!adminToken) return;
    setError(null);
    setLoading(true);
    try {
      const [dashboardResult, postsResult, reportsResult, paymentsResult] = await Promise.all([
        api.adminDashboard(adminToken, rangeParams(range)),
        api.adminPosts(adminToken, { limit: 20 }),
        api.adminReports(adminToken, { status: "open", limit: 20 }),
        api.adminPayments(adminToken, { limit: 20 })
      ]);
      setDashboard(dashboardResult);
      setPosts(postsResult.posts);
      setReports(reportsResult.reports);
      setPayments(paymentsResult.payments);
    } catch (err: any) {
      setError(err?.message ?? "Không tải được dashboard admin");
    } finally {
      setLoading(false);
    }
  }, [adminToken, range]);

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
      await loadDashboard();
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
      const result = await api.adminAiReport(adminToken, rangeParams(range));
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
                      <Ionicons name="shield-checkmark" size={14} color={colors.greenDark} />
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
          {posts.length ? posts.map((post) => (
            <Card key={post.id} style={styles.itemCard}>
              <View style={styles.headerRow}>
                <View style={styles.flex}>
                  <AppText variant="subtitle" numberOfLines={1} style={styles.itemCardTitle}>
                    {post.caption || "(Không có caption)"}
                  </AppText>
                  <AppText muted variant="caption">
                    {post.author?.displayName || "Không rõ"} · {formatDate(post.createdAt)} · {post.imageCount} ảnh · {statusLabel(post.visibility)}
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
          )) : <EmptyState label="Chưa có bài đăng." />}
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
                <RangeSelector value={range} onChange={setRange} />
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.workspaceContent}>
              <ErrorText message={error || actionError} />
              {dashboardContent}
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
          <RangeSelector value={range} onChange={setRange} />
          <ErrorText message={error || actionError} />
          <AdminTabs activeTab={activeTab} onChange={setActiveTab} />
          {dashboardContent}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

export function AdminUsersScreen({ navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    loadUsers({ page: 1, append: false });
  }, [loadUsers]);

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

  const headerControls = (
    <View style={styles.usersHeaderControls}>
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
      <Pressable style={styles.userCard} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })}>
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

            <View style={styles.workspaceUsersContent}>
              {headerControls}
              <FlatList
                key={numColumns}
                numColumns={numColumns}
                columnWrapperStyle={numColumns > 1 ? { gap: 16, marginBottom: 16 } : undefined}
                data={users}
                keyExtractor={(item) => item.id}
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
            <Ionicons name="images-outline" size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
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
            <Ionicons name="alert-circle-outline" size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
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
          <Ionicons name="time-outline" size={16} color={colors.greenDark} style={{ marginRight: 6 }} />
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
    flex: 1,
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
  twoColumn: { flexDirection: "row", gap: 16 },
  stackColumn: { flexDirection: "column", gap: 16 },

  // Metric Cards
  metricCard: {
    minWidth: 120,
    flexGrow: 1,
    flexShrink: 0
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
  rangeSelector: { flexDirection: "row", gap: 6 },
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
  chartCard: { minHeight: 260 },
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
  chartBody: { flex: 1, position: "relative", justifyContent: "flex-end", paddingTop: 14 },
  chartGrid: { ...StyleSheet.absoluteFillObject, top: 14, bottom: 20, zIndex: 1 },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderStyle: "dashed",
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  chartGridLabel: { position: "absolute", top: -11, right: 0, fontSize: 8, color: colors.muted },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 6, minHeight: 120, zIndex: 2, position: "relative" },
  barColumn: { flex: 1, alignItems: "center" },
  chartBarValue: { fontSize: 8, color: colors.muted, height: 10, marginBottom: 2, fontFamily: fonts.medium },
  barTrack: { height: 90, width: "100%", maxWidth: 22, borderRadius: 4, backgroundColor: colors.canvasStrong, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartDateLabel: { fontSize: 8, color: colors.muted, marginTop: 4 },

  // Breakdowns
  breakdownCard: { minHeight: 200 },
  breakdownTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  breakdownContainer: { gap: 10, marginTop: 6 },
  breakdownRow: { gap: 4 },
  breakdownHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: 13, color: colors.ink },
  breakdownValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  breakdownBarTrack: { height: 6, width: "100%", borderRadius: 3, backgroundColor: colors.canvasStrong, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 3 },

  // AI Report Output
  reportCard: { gap: 12 },
  reportHeader: { flexDirection: "row", gap: 10, alignItems: "center" },
  reportTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  reportDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.05)" },
  reportSection: { gap: 4, paddingTop: 4 },
  reportSectionTitle: { fontSize: 13, color: colors.greenDark, fontFamily: fonts.bold, textTransform: "uppercase", letterSpacing: 0.5 },
  reportItemRow: { flexDirection: "row", gap: 8, paddingLeft: 6 },
  reportBullet: { color: colors.muted, fontSize: 13, top: -1 },
  reportItemText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 19 },

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
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  desktopTopActions: { flexDirection: "row", alignItems: "center", gap: 10 },

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
  workspaceUsersContent: { flex: 1, padding: 20, gap: 12 },
  usersHeaderControls: { gap: 12, paddingBottom: 4 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", flexWrap: "wrap" },
  searchRowCompact: { flexDirection: "column", alignItems: "stretch" },
  searchInput: { flex: 1, width: "100%" },
  searchButton: { minHeight: 46 },
  usersCountRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  listFooter: { paddingVertical: 12, gap: 8 },

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

  detailSectionCard: { minHeight: 220, gap: 10 },
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
