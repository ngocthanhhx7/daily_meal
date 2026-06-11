import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
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
  AdminPostSummary,
  AdminReport,
  AdminReportItem,
  AdminUserDetail,
  AdminUserSummary
} from "../types/api";

type AdminTab = "overview" | "analytics" | "posts" | "reports" | "payments" | "ai";

const tabs: Array<{ key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "overview", label: "Tong quan", icon: "grid-outline" },
  { key: "analytics", label: "KPI", icon: "analytics-outline" },
  { key: "posts", label: "Bai dang", icon: "images-outline" },
  { key: "reports", label: "Report", icon: "shield-checkmark-outline" },
  { key: "payments", label: "Thanh toan", icon: "card-outline" },
  { key: "ai", label: "AI report", icon: "sparkles-outline" }
];

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
  if (!value || value === "not_instrumented") return "Chua instrumented";
  if (value === "available_no_errors") return "Da do, khong co loi";
  return "Da co du lieu";
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
      <View>
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
          14 ngay gan nhat
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
            <AppText>{item._id || "unknown"}</AppText>
            <AppText variant="button">{formatNumber(item.count)}</AppText>
          </View>
        ))
      ) : (
        <AppText muted>Chua co du lieu.</AppText>
      )}
    </Card>
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

function ReportOutput({ generatedReport }: { generatedReport: AdminReport | null }) {
  if (!generatedReport) {
    return <EmptyState label="Bam tao bao cao de AI phan tich tren du lieu dashboard hien tai." />;
  }

  const sections: Array<[string, string[]]> = [
    ["Tom tat", generatedReport.report.executiveSummary],
    ["Ky thuat", generatedReport.report.technical],
    ["Hanh vi", generatedReport.report.behavioral],
    ["Traffic", generatedReport.report.traffic],
    ["Chuyen doi", generatedReport.report.conversion],
    ["Bat thuong", generatedReport.report.anomalies],
    ["Uu tien", generatedReport.report.priorityActions],
    ["Rui ro", generatedReport.report.risks]
  ];

  return (
    <Card>
      <AppText variant="subtitle">{generatedReport.report.title}</AppText>
      <AppText muted>
        Tao luc {formatDate(generatedReport.generatedAt)} · {formatDate(generatedReport.range.start)} - {formatDate(generatedReport.range.end)}
      </AppText>
      {sections.map(([title, items]) => (
        <View key={title} style={styles.reportSection}>
          <AppText variant="button">{title}</AppText>
          {items.length ? items.map((item, index) => <AppText key={`${title}-${index}`}>- {item}</AppText>) : <AppText muted>Khong co nhan dinh.</AppText>}
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
      setError(err?.message ?? "Dang nhap admin that bai");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.loginWrap }}>
      <View style={styles.headerRow}>
        <AppText variant="title">Daily Meal Admin</AppText>
        <AppButton label="Quay lai" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
      <AppText muted>Dang nhap bang tai khoan admin da cau hinh tren server.</AppText>
      <TextField label="Email admin" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Mat khau" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      <AppButton label={submitting ? "Dang dang nhap..." : "Dang nhap admin"} onPress={submit} disabled={submitting} />
    </AppScreen>
  );
}

export function AdminDashboardScreen({ navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [posts, setPosts] = useState<AdminPostSummary[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [generatedReport, setGeneratedReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isWide = width >= 900;

  async function loadDashboard() {
    if (!adminToken) return;
    setError(null);
    setLoading(true);
    try {
      const [dashboardResult, postsResult, reportsResult, paymentsResult] = await Promise.all([
        api.adminDashboard(adminToken),
        api.adminPosts(adminToken, { limit: 20 }),
        api.adminReports(adminToken, { status: "open", limit: 20 }),
        api.adminPayments(adminToken, { limit: 20 })
      ]);
      setDashboard(dashboardResult);
      setPosts(postsResult.posts);
      setReports(reportsResult.reports);
      setPayments(paymentsResult.payments);
    } catch (err: any) {
      setError(err?.message ?? "Khong tai duoc dashboard admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [adminToken]);

  async function moderatePost(post: AdminPostSummary, moderationStatus: "visible" | "hidden" | "review") {
    if (!adminToken) return;
    setBusyAction(`post-${post.id}`);
    try {
      const result = await api.adminModeratePost(adminToken, post.id, {
        moderationStatus,
        reason: moderationStatus === "hidden" ? "Admin hidden from dashboard" : "Admin moderation update"
      });
      setPosts((current) => current.map((item) => (item.id === post.id ? result.post : item)));
      await loadDashboard();
    } finally {
      setBusyAction(null);
    }
  }

  async function updateReport(report: AdminReportItem, status: "resolved" | "dismissed" | "open") {
    if (!adminToken) return;
    setBusyAction(`report-${report.id}`);
    try {
      const result = await api.adminUpdateReport(adminToken, report.id, {
        status,
        adminNote: status === "open" ? "Mo lai report" : "Da xu ly trong admin dashboard"
      });
      setReports((current) => current.map((item) => (item.id === report.id ? result.report : item)).filter((item) => item.status === "open"));
      await loadDashboard();
    } finally {
      setBusyAction(null);
    }
  }

  async function generateReport() {
    if (!adminToken) return;
    setBusyAction("ai-report");
    setError(null);
    try {
      const result = await api.adminAiReport(adminToken, dashboard?.range);
      setGeneratedReport(result);
    } catch (err: any) {
      setError(err?.message ?? "Khong tao duoc bao cao AI");
    } finally {
      setBusyAction(null);
    }
  }

  const overviewMetrics = useMemo(() => {
    if (!dashboard) return [];
    return [
      ["Tong user", dashboard.totals.users, `${dashboard.totals.premiumUsers} premium`],
      ["Tong bai dang", dashboard.totals.posts, `${dashboard.totals.hiddenPosts} dang an`],
      ["Tuong tac", dashboard.totals.likes + dashboard.totals.saves + dashboard.totals.comments, "like + save + comment"],
      ["Doanh thu", formatCurrency(dashboard.totals.revenue), `${dashboard.totals.payments} giao dich`],
      ["Report mo", dashboard.totals.openReports, "can xu ly"],
      ["AI meal", dashboard.totals.meals, "luot phan tich mon an"]
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
      <View style={styles.headerRow}>
        <View>
          <AppText variant="title">Admin suite</AppText>
          <AppText muted>Dashboard, moderation, payments va bao cao AI</AppText>
        </View>
        <View style={styles.headerActions}>
          <AppButton label="Users" size="sm" variant="ghost" onPress={() => navigation.navigate("AdminUsers")} />
          <AppButton label="Refresh" size="sm" variant="ghost" onPress={loadDashboard} disabled={loading} />
          <AppButton label="Dang xuat" size="sm" variant="ghost" onPress={signOut} />
        </View>
      </View>

      {error ? <AppText style={styles.error}>{error}</AppText> : null}
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
                <MiniBarChart data={dashboard.charts.daily} field="users" label="User moi" color={colors.greenDark} />
                <MiniBarChart data={dashboard.charts.daily} field="interactions" label="Tuong tac" color={colors.blue} />
              </View>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <BreakdownList title="Nguoi dung" data={dashboard.breakdowns.usersByPremium} />
                <BreakdownList title="Bai dang theo trang thai" data={dashboard.breakdowns.postsByModeration} />
              </View>
              <SectionHeader title="Audit gan day" />
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
                <EmptyState label="Chua co audit action." />
              )}
            </>
          ) : null}

          {activeTab === "analytics" ? (
            <>
              <View style={styles.grid}>
                <MetricCard label="DAU / WAU / MAU" value={`${dashboard.analytics.activeUsers.dau} / ${dashboard.analytics.activeUsers.wau} / ${dashboard.analytics.activeUsers.mau}`} note={`${dashboard.analytics.activeUsers.returning} returning`} />
                <MetricCard label="Session trung binh" value={`${Math.round(dashboard.analytics.sessions.averageDurationMs / 1000)}s`} note={`Bounce ${formatPercent(dashboard.analytics.sessions.bounceRate)}`} />
                <MetricCard label="Feed CTR" value={formatPercent(dashboard.analytics.feed.ctr)} note={`Scroll TB ${formatNumber(dashboard.analytics.feed.averageScrollDepth)}%`} />
                <MetricCard label="API response" value={`${Math.round(dashboard.analytics.technical.averageApiResponseMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.apiResponseTime)} />
                <MetricCard label="Image load" value={`${Math.round(dashboard.analytics.technical.averageImageLoadMs)}ms`} note={metricStatus(dashboard.analytics.technical.instrumentation.imageLoadSpeed)} />
                <MetricCard label="Crash/runtime" value={dashboard.analytics.technical.runtimeErrors} note={`Crash rate ${formatPercent(dashboard.analytics.technical.crashRate)}`} />
              </View>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <MiniBarChart data={dashboard.charts.daily} field="posts" label="Bai dang moi" color={colors.green} />
                <MiniBarChart data={dashboard.charts.daily} field="apiErrors" label="Loi runtime/API" color={colors.red} />
              </View>
              <View style={styles.grid}>
                <MetricCard label="Creator conversion" value={formatPercent(dashboard.analytics.creatorConversion.rate)} note={`${dashboard.analytics.creatorConversion.completed}/${dashboard.analytics.creatorConversion.started}`} />
                <MetricCard label="Post completion" value={formatPercent(dashboard.analytics.postCreation.completionRate)} note={`${dashboard.analytics.postCreation.completed}/${dashboard.analytics.postCreation.started}`} />
                <MetricCard label="Meal AI completion" value={formatPercent(dashboard.analytics.mealAnalysis.completionRate)} note={`${dashboard.analytics.mealAnalysis.completed}/${dashboard.analytics.mealAnalysis.started}`} />
                <MetricCard label="Premium payment" value={formatPercent(dashboard.analytics.premiumFunnel.paymentCompletionRate)} note={`${dashboard.analytics.premiumFunnel.paymentCompleted}/${dashboard.analytics.premiumFunnel.paymentStarted}`} />
              </View>
            </>
          ) : null}

          {activeTab === "posts" ? (
            <>
              <SectionHeader title="Quan ly bai dang" subtitle="Soft moderation: an, dua vao review, hoac khoi phuc." />
              {posts.length ? posts.map((post) => (
                <Card key={post.id}>
                  <View style={styles.headerRow}>
                    <View style={styles.flex}>
                      <AppText variant="subtitle" numberOfLines={1}>{post.caption || "(Khong caption)"}</AppText>
                      <AppText muted>{post.author?.displayName || "Unknown"} · {formatDate(post.createdAt)} · {post.imageCount} anh</AppText>
                    </View>
                    <Pill label={post.moderationStatus} tone={post.moderationStatus === "hidden" ? "bad" : post.moderationStatus === "review" ? "warn" : "good"} />
                  </View>
                  <AppText muted>Likes {post.stats.likes} · Comments {post.stats.comments} · Saves {post.stats.saves}</AppText>
                  <View style={styles.actionRow}>
                    <AppButton label="An" size="sm" variant="danger" onPress={() => moderatePost(post, "hidden")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Review" size="sm" variant="ghost" onPress={() => moderatePost(post, "review")} disabled={busyAction === `post-${post.id}`} />
                    <AppButton label="Khoi phuc" size="sm" variant="secondary" onPress={() => moderatePost(post, "visible")} disabled={busyAction === `post-${post.id}`} />
                  </View>
                </Card>
              )) : <EmptyState label="Chua co bai dang." />}
            </>
          ) : null}

          {activeTab === "reports" ? (
            <>
              <SectionHeader title="Hang doi report" subtitle="Mac dinh hien report dang mo." />
              {reports.length ? reports.map((report) => (
                <Card key={report.id}>
                  <View style={styles.headerRow}>
                    <View style={styles.flex}>
                      <AppText variant="subtitle">{report.target?.displayName || "Nguoi dung bi report"}</AppText>
                      <AppText muted>Reporter: {report.actor?.displayName || "Unknown"} · {formatDate(report.createdAt)}</AppText>
                    </View>
                    <Pill label={report.status} tone={report.status === "open" ? "warn" : "good"} />
                  </View>
                  <AppText>{report.note || "Khong co ghi chu."}</AppText>
                  <View style={styles.actionRow}>
                    <AppButton label="Da xu ly" size="sm" variant="secondary" onPress={() => updateReport(report, "resolved")} disabled={busyAction === `report-${report.id}`} />
                    <AppButton label="Bo qua" size="sm" variant="ghost" onPress={() => updateReport(report, "dismissed")} disabled={busyAction === `report-${report.id}`} />
                  </View>
                </Card>
              )) : <EmptyState label="Khong co report dang mo." />}
            </>
          ) : null}

          {activeTab === "payments" ? (
            <>
              <View style={[styles.twoColumn, !isWide && styles.stackColumn]}>
                <MiniBarChart data={dashboard.charts.daily} field="payments" label="Thanh toan thanh cong" color={colors.yellow} />
                <MiniBarChart data={dashboard.charts.daily} field="revenue" label="Doanh thu" color={colors.greenDark} />
              </View>
              <BreakdownList title="Trang thai thanh toan" data={dashboard.breakdowns.paymentsByStatus} />
              {payments.length ? payments.map((payment) => (
                <Card key={payment.id}>
                  <View style={styles.headerRow}>
                    <View>
                      <AppText variant="subtitle">{payment.planId}</AppText>
                      <AppText muted>{payment.user?.email || payment.user?.displayName || "Unknown user"}</AppText>
                    </View>
                    <Pill label={payment.status} tone={payment.status === "PAID" ? "good" : payment.status === "PENDING" ? "warn" : "neutral"} />
                  </View>
                  <AppText>{formatCurrency(payment.amount)} · Order {payment.orderCode}</AppText>
                  <AppText variant="caption" muted>Tao: {formatDate(payment.createdAt)} · Paid: {formatDate(payment.paidAt)}</AppText>
                </Card>
              )) : <EmptyState label="Chua co thanh toan." />}
            </>
          ) : null}

          {activeTab === "ai" ? (
            <>
              <Card>
                <View style={styles.headerRow}>
                  <View style={styles.flex}>
                    <AppText variant="subtitle">Bao cao AI theo tai lieu KPI</AppText>
                    <AppText muted>AI tong hop technical, behavioral, traffic, conversion, anomaly va action items.</AppText>
                  </View>
                  <AppButton label={busyAction === "ai-report" ? "Dang tao..." : "Generate"} size="sm" onPress={generateReport} disabled={busyAction === "ai-report"} />
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
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.adminUsers(adminToken, { q: query.trim() || undefined, limit: 40 });
      setUsers(result.users);
    } catch (err: any) {
      setError(err?.message ?? "Khong tai duoc danh sach user");
    } finally {
      setLoading(false);
    }
  }

  async function togglePremium(user: AdminUserSummary) {
    if (!adminToken) return;
    setBusyUser(user.id);
    try {
      const result = await api.adminSetUserPremium(adminToken, user.id, {
        isPremium: !user.isPremium,
        note: "Updated from admin user list"
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...result.user } : item)));
    } finally {
      setBusyUser(null);
    }
  }

  useEffect(() => {
    load();
  }, [adminToken]);

  return (
    <AppScreen style={styles.wrap}>
      <View style={styles.headerRow}>
        <View>
          <AppText variant="title">Quan ly user</AppText>
          <AppText muted>Tim kiem, drill-down va cap nhat premium thu cong.</AppText>
        </View>
        <AppButton label="Dashboard" size="sm" variant="ghost" onPress={() => navigation.navigate("AdminDashboard")} />
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField label="Tim kiem" value={query} onChangeText={setQuery} placeholder="Ten, email, SDT" />
        </View>
        <AppButton label="Tim" size="sm" onPress={load} disabled={loading} />
      </View>
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {loading ? <ActivityIndicator color={colors.green} /> : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.userCard} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <AppText variant="subtitle">{item.displayName}</AppText>
                <AppText muted>{item.email || item.phone || item.id}</AppText>
              </View>
              <Pill label={item.isPremium ? "Premium" : "Free"} tone={item.isPremium ? "good" : "neutral"} />
            </View>
            <AppText muted>
              Posts {item.stats.posts} · Followers {item.stats.followers} · Following {item.stats.following} · Reports {item.stats.reports}
            </AppText>
            <View style={styles.actionRow}>
              <AppButton label={item.isPremium ? "Tat premium" : "Bat premium"} size="sm" variant="ghost" onPress={() => togglePremium(item)} disabled={busyUser === item.id} />
              <AppButton label="Chi tiet" size="sm" onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })} />
            </View>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

export function AdminUserDetailScreen({ route, navigation }: any) {
  const { adminToken } = useAuth();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    try {
      const result = await api.adminUser(adminToken, route.params.id);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  }

  async function togglePremium() {
    if (!adminToken || !user) return;
    setBusy(true);
    try {
      const result = await api.adminSetUserPremium(adminToken, user.id, {
        isPremium: !user.isPremium,
        note: "Updated from admin user detail"
      });
      setUser((current) => (current ? { ...current, ...result.user } : current));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [adminToken, route.params.id]);

  if (loading || !user) {
    return (
      <AppScreen>
        <ActivityIndicator color={colors.green} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.wrap }}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText variant="title">{user.displayName}</AppText>
          <AppText muted>{user.email || user.phone || user.id}</AppText>
        </View>
        <AppButton label="Quay lai" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.grid}>
        <MetricCard label="Bai dang" value={user.stats.posts} />
        <MetricCard label="Follower" value={user.stats.followers} />
        <MetricCard label="Following" value={user.stats.following} />
        <MetricCard label="Report" value={user.stats.reports} />
      </View>
      <Card>
        <View style={styles.headerRow}>
          <View>
            <AppText variant="subtitle">Ho so</AppText>
            <AppText>Premium: {user.isPremium ? "Co" : "Khong"}</AppText>
          </View>
          <AppButton label={user.isPremium ? "Tat premium" : "Bat premium"} size="sm" variant="ghost" onPress={togglePremium} disabled={busy} />
        </View>
        <AppText>Bio: {user.bio || "-"}</AppText>
        <AppText>Interests: {user.preferences?.interests?.join(", ") || "-"}</AppText>
        <AppText>Eating styles: {user.preferences?.eatingStyles?.join(", ") || "-"}</AppText>
        <AppText muted>Tao: {formatDate(user.createdAt)} · Cap nhat: {formatDate(user.updatedAt)}</AppText>
      </Card>
      <Card>
        <AppText variant="subtitle">Bai dang gan day</AppText>
        {user.recentPosts.length ? (
          user.recentPosts.map((post) => (
            <View key={post.id} style={styles.listLine}>
              <AppText>{post.caption || "(Khong caption)"}</AppText>
              <AppText variant="caption" muted>{post.visibility} · {post.moderationStatus ?? "visible"} · {formatDate(post.createdAt)}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Khong co bai dang.</AppText>
        )}
      </Card>
      <Card>
        <AppText variant="subtitle">Tuong tac can chu y</AppText>
        {user.interactions.length ? (
          user.interactions.map((interaction) => (
            <View key={interaction.id} style={styles.listLine}>
              <View style={styles.headerRow}>
                <AppText>{interaction.type}: {interaction.note || "-"}</AppText>
                <Pill label={interaction.status ?? "open"} tone={interaction.status === "resolved" ? "good" : interaction.status === "dismissed" ? "neutral" : "warn"} />
              </View>
              <AppText variant="caption" muted>{formatDate(interaction.createdAt)} · {interaction.adminNote || ""}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Khong co du lieu.</AppText>
        )}
      </Card>
      <Card>
        <AppText variant="subtitle">Audit user</AppText>
        {user.audit?.length ? (
          user.audit.map((item) => (
            <View key={item.id} style={styles.listLine}>
              <AppText>{item.action}</AppText>
              <AppText variant="caption" muted>{formatDate(item.createdAt)} · {item.note || ""}</AppText>
            </View>
          ))
        ) : (
          <AppText muted>Chua co audit.</AppText>
        )}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingBottom: 28 },
  loginWrap: { gap: 16, justifyContent: "center", minHeight: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
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
  userCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 14, gap: 8, marginBottom: 12 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  searchInput: { flex: 1 },
  inlineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportSection: { gap: 4, paddingTop: 8 },
  listLine: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1 },
  pill: { backgroundColor: colors.canvasStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  pillGood: { backgroundColor: colors.green },
  pillWarn: { backgroundColor: colors.yellow },
  pillBad: { backgroundColor: colors.red, color: colors.white },
  error: { color: colors.red }
});
