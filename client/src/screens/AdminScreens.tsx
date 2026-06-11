import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
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

type AdminTab = "overview" | "analytics" | "posts" | "reports" | "payments" | "ai";
type AdminRange = "1d" | "7d" | "all";

const USER_PAGE_SIZE = 50;

const tabs: Array<{ key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "overview", label: "Tổng quan", icon: "grid-outline" },
  { key: "analytics", label: "KPI", icon: "analytics-outline" },
  { key: "posts", label: "Bài đăng", icon: "images-outline" },
  { key: "reports", label: "Báo cáo", icon: "shield-checkmark-outline" },
  { key: "payments", label: "Thanh toán", icon: "card-outline" },
  { key: "ai", label: "Báo cáo AI", icon: "sparkles-outline" }
];

const rangeOptions: Array<{ key: AdminRange; label: string }> = [
  { key: "1d", label: "1 ngày" },
  { key: "7d", label: "7 ngày" },
  { key: "all", label: "Tất cả" }
];

function rangeParams(range: AdminRange) {
  return { range };
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
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
  if (value === "available_no_errors") return "Đã đo, không có lỗi";
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

function MetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Card style={styles.metricCard}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="title">{typeof value === "number" ? formatNumber(value) : value}</AppText>
      {note ? (
        <AppText variant="caption" muted>
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
        <AppText variant="subtitle">{title}</AppText>
        {subtitle ? <AppText muted>{subtitle}</AppText> : null}
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
        tone === "bad" && styles.pillBad
      ]}
    >
      {label}
    </AppText>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <AppText muted>{label}</AppText>
    </Card>
  );
}

function ErrorText({ message }: { message?: string | null }) {
  return message ? <AppText style={styles.error}>{message}</AppText> : null;
}

function RangeSelector({ value, onChange }: { value: AdminRange; onChange: (range: AdminRange) => void }) {
  return (
    <View style={styles.rangeSelector}>
      {rangeOptions.map((item) => {
        const active = item.key === value;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.rangeButton, active && styles.rangeButtonActive]}>
            <AppText variant="caption" style={active && styles.rangeTextActive}>
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
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tab, active && styles.tabActive]}>
            <Ionicons name={tab.icon} size={16} color={active ? colors.white : colors.ink} />
            <AppText variant="caption" style={active && styles.tabTextActive}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function MiniBarChart({
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
  const max = Math.max(1, ...data.map((item) => Number(item[field] ?? 0)));
  const compactData = data.slice(-14);

  return (
    <Card style={styles.chartCard}>
      <View style={styles.headerRow}>
        <AppText variant="subtitle">{label}</AppText>
        <AppText variant="caption" muted>
          {compactData.length} mốc gần nhất
        </AppText>
      </View>
      <View style={styles.barChart}>
        {compactData.map((item) => {
          const value = Number(item[field] ?? 0);
          return (
            <View key={`${field}-${item.date}`} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }]} />
              </View>
              <AppText variant="caption" muted numberOfLines={1}>
                {item.date.slice(5)}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function BreakdownList({ title, data }: { title: string; data: AdminDashboard["breakdowns"]["usersByPremium"] }) {
  return (
    <Card>
      <AppText variant="subtitle">{title}</AppText>
      {data.length ? (
        data.map((item) => (
          <View key={`${title}-${item._id}`} style={styles.inlineRow}>
            <AppText>{statusLabel(item._id)}</AppText>
            <AppText variant="button">{formatNumber(item.count)}</AppText>
          </View>
        ))
      ) : (
        <AppText muted>Chưa có dữ liệu.</AppText>
      )}
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
    <Card>
      <AppText variant="subtitle">{generatedReport.report.title}</AppText>
      <AppText muted>
        Tạo lúc {formatDate(generatedReport.generatedAt)} · {formatDate(generatedReport.range.start)} - {formatDate(generatedReport.range.end)}
      </AppText>
      {sections.map(([title, items]) => (
        <View key={title} style={styles.reportSection}>
          <AppText variant="button">{title}</AppText>
          {items.length ? items.map((item, index) => <AppText key={`${title}-${index}`}>- {item}</AppText>) : <AppText muted>Không có nhận định.</AppText>}
        </View>
      ))}
    </Card>
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
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.loginWrap }}>
      <View style={styles.headerRow}>
        <AppText variant="title">Daily Meal Admin</AppText>
        <AppButton label="Quay lại" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
      <AppText muted>Đăng nhập bằng tài khoản admin đã cấu hình trên server.</AppText>
      <TextField label="Email admin" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText message={error} />
      <AppButton label={submitting ? "Đang đăng nhập..." : "Đăng nhập admin"} onPress={submit} disabled={submitting} />
    </AppScreen>
  );
}

export function AdminDashboardScreen({ navigation }: any) {
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
  const compactHeader = width < 760;
  const isWide = width >= 900;

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
      <AppScreen>
        <ActivityIndicator color={colors.green} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.wrap }}>
      <View style={[styles.adminHeader, compactHeader && styles.adminHeaderCompact]}>
        <View style={styles.headerTitle}>
          <AppText variant="title">Bộ quản trị</AppText>
          <AppText muted>Tổng quan, kiểm duyệt, thanh toán và báo cáo AI</AppText>
        </View>
        <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
          <AppButton label="Người dùng" size="sm" variant="ghost" onPress={() => navigation.navigate("AdminUsers")} />
          <AppButton label="Làm mới" size="sm" variant="ghost" onPress={loadDashboard} disabled={loading} />
          <AppButton label={busyAction === "sign-out" ? "Đang thoát..." : "Đăng xuất"} size="sm" variant="danger" onPress={handleSignOut} disabled={busyAction === "sign-out"} />
        </View>
      </View>

      <RangeSelector value={range} onChange={setRange} />
      <ErrorText message={error || actionError} />
      <AdminTabs activeTab={activeTab} onChange={setActiveTab} />

      {dashboard ? (
        <>
          {activeTab === "overview" ? (
            <>
              <View style={styles.grid}>
                {overviewMetrics.map(([label, value, note]) => (
                  <MetricCard key={label} label={label} value={value} note={note} />
                ))}
              </View>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <MiniBarChart data={dashboard.charts.daily} field="users" label="Người dùng mới" color={colors.greenDark} />
                <MiniBarChart data={dashboard.charts.daily} field="interactions" label="Tương tác" color={colors.blue} />
              </View>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <BreakdownList title="Người dùng" data={dashboard.breakdowns.usersByPremium} />
                <BreakdownList title="Bài đăng theo trạng thái" data={dashboard.breakdowns.postsByModeration} />
              </View>
              <SectionHeader title="Audit gần đây" />
              {dashboard.recent.audit.length ? (
                dashboard.recent.audit.map((item) => (
                  <Card key={item.id}>
                    <View style={styles.headerRow}>
                      <AppText variant="button">{item.action}</AppText>
                      <AppText variant="caption" muted>{formatDate(item.createdAt)}</AppText>
                    </View>
                    <AppText muted>{item.targetType}: {item.targetId}</AppText>
                  </Card>
                ))
              ) : (
                <EmptyState label="Chưa có audit action." />
              )}
            </>
          ) : null}

          {activeTab === "analytics" ? (
            <>
              <View style={styles.grid}>
                <MetricCard label="DAU / WAU / MAU" value={`${dashboard.analytics.activeUsers.dau} / ${dashboard.analytics.activeUsers.wau} / ${dashboard.analytics.activeUsers.mau}`} note={`${dashboard.analytics.activeUsers.returning} user quay lại`} />
                <MetricCard label="Phiên trung bình" value={`${Math.round(dashboard.analytics.sessions.averageDurationMs / 1000)}s`} note={`Thoát nhanh ${formatPercent(dashboard.analytics.sessions.bounceRate)}`} />
                <MetricCard label="Tỷ lệ bấm bảng tin" value={formatPercent(dashboard.analytics.feed.ctr)} note={`Độ sâu cuộn TB ${formatNumber(dashboard.analytics.feed.averageScrollDepth)}%`} />
                <MetricCard label="Phản hồi API" value={`${Math.round(dashboard.analytics.technical.averageApiResponseMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.apiResponseTime)} />
                <MetricCard label="Tải ảnh" value={`${Math.round(dashboard.analytics.technical.averageImageLoadMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.imageLoadSpeed)} />
                <MetricCard label="Lỗi runtime" value={dashboard.analytics.technical.runtimeErrors} note={`Tỷ lệ lỗi ${formatPercent(dashboard.analytics.technical.crashRate)}`} />
              </View>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <MiniBarChart data={dashboard.charts.daily} field="posts" label="Bài đăng mới" color={colors.green} />
                <MiniBarChart data={dashboard.charts.daily} field="apiErrors" label="Lỗi runtime/API" color={colors.red} />
              </View>
              <View style={styles.grid}>
                <MetricCard label="Chuyển đổi creator" value={formatPercent(dashboard.analytics.creatorConversion.rate)} note={`${dashboard.analytics.creatorConversion.completed}/${dashboard.analytics.creatorConversion.started}`} />
                <MetricCard label="Hoàn tất đăng bài" value={formatPercent(dashboard.analytics.postCreation.completionRate)} note={`${dashboard.analytics.postCreation.completed}/${dashboard.analytics.postCreation.started}`} />
                <MetricCard label="Hoàn tất AI món ăn" value={formatPercent(dashboard.analytics.mealAnalysis.completionRate)} note={`${dashboard.analytics.mealAnalysis.completed}/${dashboard.analytics.mealAnalysis.started}`} />
                <MetricCard label="Thanh toán premium" value={formatPercent(dashboard.analytics.premiumFunnel.paymentCompletionRate)} note={`${dashboard.analytics.premiumFunnel.paymentCompleted}/${dashboard.analytics.premiumFunnel.paymentStarted}`} />
              </View>
            </>
          ) : null}

          {activeTab === "posts" ? (
            <>
              <SectionHeader title="Quản lý bài đăng" subtitle="Kiểm duyệt mềm: ẩn, đưa vào review hoặc khôi phục." />
              {posts.length ? posts.map((post) => (
                <Card key={post.id}>
                  <View style={styles.headerRow}>
                    <View style={styles.flex}>
                      <AppText variant="subtitle" numberOfLines={1}>{post.caption || "(Không có caption)"}</AppText>
                    <AppText muted>{post.author?.displayName || "Không rõ"} · {formatDate(post.createdAt)} · {post.imageCount} ảnh · {statusLabel(post.visibility)}</AppText>
                    </View>
                    <Pill label={statusLabel(post.moderationStatus)} tone={post.moderationStatus === "hidden" ? "bad" : post.moderationStatus === "review" ? "warn" : "good"} />
                  </View>
                  <AppText muted>Lượt thích {post.stats.likes} · Bình luận {post.stats.comments} · Lưu {post.stats.saves}</AppText>
                  <View style={styles.actionRow}>
                    <AppButton label="Ẩn" size="sm" variant="danger" onPress={() => moderatePost(post, "hidden")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Cần xem lại" size="sm" variant="ghost" onPress={() => moderatePost(post, "review")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Khôi phục" size="sm" variant="secondary" onPress={() => moderatePost(post, "visible")} disabled={busyAction === `post-${post.id}`} />
                  </View>
                </Card>
              )) : <EmptyState label="Chưa có bài đăng." />}
            </>
          ) : null}

          {activeTab === "reports" ? (
            <>
              <SectionHeader title="Hàng đợi báo cáo" subtitle="Mặc định hiển thị các báo cáo đang mở." />
              {reports.length ? reports.map((report) => (
                <Card key={report.id}>
                  <View style={styles.headerRow}>
                    <View style={styles.flex}>
                      <AppText variant="subtitle">{report.target?.displayName || "Người dùng bị báo cáo"}</AppText>
                      <AppText muted>Người báo cáo: {report.actor?.displayName || "Không rõ"} · {formatDate(report.createdAt)}</AppText>
                    </View>
                    <Pill label={statusLabel(report.status)} tone={report.status === "open" ? "warn" : "good"} />
                  </View>
                  <AppText>{report.note || "Không có ghi chú."}</AppText>
                  <View style={styles.actionRow}>
                    <AppButton label="Đã xử lý" size="sm" variant="secondary" onPress={() => updateReport(report, "resolved")} disabled={busyAction === `report-${report.id}`} />
                    <AppButton label="Bỏ qua" size="sm" variant="ghost" onPress={() => updateReport(report, "dismissed")} disabled={busyAction === `report-${report.id}`} />
                  </View>
                </Card>
              )) : <EmptyState label="Không có báo cáo đang mở." />}
            </>
          ) : null}

          {activeTab === "payments" ? (
            <>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <MiniBarChart data={dashboard.charts.daily} field="payments" label="Thanh toán thành công" color={colors.yellow} />
                <MiniBarChart data={dashboard.charts.daily} field="revenue" label="Doanh thu" color={colors.greenDark} />
              </View>
              <BreakdownList title="Trạng thái thanh toán" data={dashboard.breakdowns.paymentsByStatus} />
              {payments.length ? payments.map((payment) => (
                <Card key={payment.id}>
                  <View style={styles.headerRow}>
                    <View>
                      <AppText variant="subtitle">{payment.planId}</AppText>
                      <AppText muted>{payment.user?.email || payment.user?.displayName || "Không rõ người dùng"}</AppText>
                    </View>
                    <Pill label={statusLabel(payment.status)} tone={payment.status === "PAID" ? "good" : payment.status === "PENDING" ? "warn" : "neutral"} />
                  </View>
                  <AppText>{formatCurrency(payment.amount)} · Mã đơn {payment.orderCode}</AppText>
                  <AppText variant="caption" muted>Tạo: {formatDate(payment.createdAt)} · Thanh toán: {formatDate(payment.paidAt)}</AppText>
                </Card>
              )) : <EmptyState label="Chưa có thanh toán." />}
            </>
          ) : null}

          {activeTab === "ai" ? (
            <>
              <Card>
                <View style={[styles.headerRow, compactHeader && styles.headerRowWrap]}>
                  <View style={styles.flex}>
                    <AppText variant="subtitle">Báo cáo AI theo tài liệu KPI</AppText>
                    <AppText muted>AI tổng hợp kỹ thuật, hành vi, lưu lượng, chuyển đổi, bất thường và hành động ưu tiên.</AppText>
                  </View>
                  <AppButton label={busyAction === "ai-report" ? "Đang tạo..." : "Tạo báo cáo"} size="sm" onPress={generateReport} disabled={busyAction === "ai-report"} />
                </View>
              </Card>
              <ReportOutput generatedReport={generatedReport} />
            </>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

export function AdminUsersScreen({ navigation }: any) {
  const { adminToken } = useAuth();
  const { width } = useWindowDimensions();
  const compactHeader = width < 760;
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState<AdminPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const header = (
    <View style={styles.listHeader}>
      <View style={[styles.adminHeader, compactHeader && styles.adminHeaderCompact]}>
        <View style={styles.headerTitle}>
          <AppText variant="title">Quản lý người dùng</AppText>
          <AppText muted>Tìm kiếm, xem chi tiết và cập nhật premium thủ công.</AppText>
        </View>
        <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
          <AppButton label="Dashboard" size="sm" variant="ghost" onPress={() => navigation.navigate("AdminDashboard")} />
        </View>
      </View>
      <View style={[styles.searchRow, compactHeader && styles.searchRowCompact]}>
        <View style={styles.searchInput}>
          <TextField label="Tìm kiếm" value={query} onChangeText={setQuery} placeholder="Tên, email, SĐT" />
        </View>
        <AppButton label="Tìm" size="sm" onPress={() => loadUsers({ page: 1, append: false })} disabled={loading} />
      </View>
      <ErrorText message={error} />
      {pagination ? (
        <AppText muted>Đã tải {formatNumber(users.length)} / {formatNumber(pagination.total)} người dùng</AppText>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.listFooter}>
      {loading || loadingMore || loadingAll ? <ActivityIndicator color={colors.green} /> : null}
      {pagination && pagination.page < pagination.pages ? (
        <View style={styles.actionRow}>
          <AppButton label={loadingMore ? "Đang tải..." : "Tải thêm"} size="sm" variant="ghost" onPress={loadMore} disabled={loadingMore || loadingAll} />
          <AppButton label={loadingAll ? "Đang tải tất cả..." : "Tải tất cả"} size="sm" onPress={loadAll} disabled={loadingMore || loadingAll} />
        </View>
      ) : pagination ? (
        <AppText muted>Đã tải toàn bộ người dùng phù hợp.</AppText>
      ) : null}
    </View>
  );

  return (
    <AppScreen scroll={false} style={styles.flatScreen}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.flatContent}
        renderItem={({ item }) => (
          <Pressable style={styles.userCard} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <AppText variant="subtitle">{item.displayName}</AppText>
                <AppText muted>{item.email || item.phone || item.id}</AppText>
              </View>
              <Pill label={item.isPremium ? "Premium" : "Miễn phí"} tone={item.isPremium ? "good" : "neutral"} />
            </View>
            <AppText muted>
              Bài đăng {item.stats.posts} · Người theo dõi {item.stats.followers} · Đang theo dõi {item.stats.following} · Báo cáo {item.stats.reports}
            </AppText>
            <View style={styles.actionRow}>
              <AppButton label={item.isPremium ? "Tắt premium" : "Bật premium"} size="sm" variant="ghost" onPress={() => togglePremium(item)} disabled={busyUser === item.id} />
              <AppButton label="Chi tiết" size="sm" onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <EmptyState label="Không có người dùng phù hợp." /> : null}
      />
    </AppScreen>
  );
}

export function AdminUserDetailScreen({ route, navigation }: any) {
  const { adminToken } = useAuth();
  const { width } = useWindowDimensions();
  const compactHeader = width < 760;
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !user) {
    return (
      <AppScreen>
        <ActivityIndicator color={colors.green} />
        <ErrorText message={error} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.wrap }}>
      <View style={[styles.adminHeader, compactHeader && styles.adminHeaderCompact]}>
        <View style={styles.headerTitle}>
          <AppText variant="title">{user.displayName}</AppText>
          <AppText muted>{user.email || user.phone || user.id}</AppText>
        </View>
        <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
          <AppButton label="Quay lại" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </View>
      <ErrorText message={error} />
      <View style={styles.grid}>
        <MetricCard label="Bài đăng" value={user.stats.posts} />
        <MetricCard label="Người theo dõi" value={user.stats.followers} />
        <MetricCard label="Đang theo dõi" value={user.stats.following} />
        <MetricCard label="Báo cáo" value={user.stats.reports} />
      </View>
      <Card>
        <View style={styles.headerRow}>
          <View>
            <AppText variant="subtitle">Hồ sơ</AppText>
            <AppText>Premium: {user.isPremium ? "Có" : "Không"}</AppText>
          </View>
          <AppButton label={user.isPremium ? "Tắt premium" : "Bật premium"} size="sm" variant="ghost" onPress={togglePremium} disabled={busy} />
        </View>
        <AppText>Tiểu sử: {user.bio || "-"}</AppText>
        <AppText>Sở thích: {user.preferences?.interests?.join(", ") || "-"}</AppText>
        <AppText>Kiểu ăn uống: {user.preferences?.eatingStyles?.join(", ") || "-"}</AppText>
        <AppText muted>Tạo: {formatDate(user.createdAt)} · Cập nhật: {formatDate(user.updatedAt)}</AppText>
      </Card>
      <Card>
        <AppText variant="subtitle">Bài đăng gần đây</AppText>
        {user.recentPosts.length ? (
          user.recentPosts.map((post) => (
            <View key={post.id} style={styles.listLine}>
              <AppText>{post.caption || "(Không có caption)"}</AppText>
              <AppText variant="caption" muted>{statusLabel(post.visibility)} · {statusLabel(post.moderationStatus)} · {formatDate(post.createdAt)}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Không có bài đăng.</AppText>
        )}
      </Card>
      <Card>
        <AppText variant="subtitle">Tương tác cần chú ý</AppText>
        {user.interactions.length ? (
          user.interactions.map((interaction) => (
            <View key={interaction.id} style={styles.listLine}>
              <View style={styles.headerRow}>
                <AppText>{statusLabel(interaction.type)}: {interaction.note || "-"}</AppText>
                <Pill label={statusLabel(interaction.status)} tone={interaction.status === "resolved" ? "good" : interaction.status === "dismissed" ? "neutral" : "warn"} />
              </View>
              <AppText variant="caption" muted>{formatDate(interaction.createdAt)} · {interaction.adminNote || ""}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Không có dữ liệu.</AppText>
        )}
      </Card>
      <Card>
        <AppText variant="subtitle">Lịch sử thao tác người dùng</AppText>
        {user.audit?.length ? (
          user.audit.map((item) => (
            <View key={item.id} style={styles.listLine}>
              <AppText>{item.action}</AppText>
              <AppText variant="caption" muted>{formatDate(item.createdAt)} · {item.note || ""}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Chưa có audit.</AppText>
        )}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingBottom: 28 },
  flatScreen: { padding: 0 },
  flatContent: { padding: 20, gap: 12, paddingBottom: 28 },
  loginWrap: { gap: 16, justifyContent: "center", minHeight: "100%" },
  adminHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  adminHeaderCompact: { flexDirection: "column" },
  headerTitle: { flex: 1, minWidth: 0, gap: 4 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", flexShrink: 1 },
  headerActionsCompact: { justifyContent: "flex-start", width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerRowWrap: { flexWrap: "wrap" },
  listHeader: { gap: 14, paddingBottom: 6 },
  listFooter: { gap: 10, paddingVertical: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  twoColumn: { flexDirection: "row", gap: 12 },
  stackColumn: { flexDirection: "column" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 16, gap: 8, flex: 1 },
  metricCard: { minWidth: 150 },
  chartCard: { minHeight: 190 },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 7, minHeight: 124 },
  barColumn: { flex: 1, alignItems: "center", gap: 6, minWidth: 18 },
  barTrack: { height: 90, width: "100%", maxWidth: 22, borderRadius: 4, backgroundColor: colors.canvasStrong, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  tabActive: { backgroundColor: colors.black, borderColor: colors.black },
  tabTextActive: { color: colors.white },
  rangeSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rangeButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  rangeButtonActive: { backgroundColor: colors.black, borderColor: colors.black },
  rangeTextActive: { color: colors.white },
  userCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 14, gap: 8 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  searchRowCompact: { flexDirection: "column", alignItems: "stretch" },
  searchInput: { flex: 1, width: "100%" },
  inlineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportSection: { gap: 4, paddingTop: 8 },
  listLine: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1, minWidth: 0 },
  pill: { backgroundColor: colors.canvasStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  pillGood: { backgroundColor: colors.green },
  pillWarn: { backgroundColor: colors.yellow },
  pillBad: { backgroundColor: colors.red, color: colors.white },
  error: { color: colors.red }
});
