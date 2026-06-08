import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import type { AdminDashboard, AdminUserDetail, AdminUserSummary } from "../types/api";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.card}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="title">{value.toLocaleString()}</AppText>
    </View>
  );
}

export function AdminLoginScreen() {
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
      <AppText variant="title">Admin Daily Meal</AppText>
      <AppText muted>Đăng nhập bằng credential admin được cấu hình trong server.</AppText>
      <TextField label="Email admin" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      <AppButton label={submitting ? "Đang đăng nhập..." : "Đăng nhập admin"} onPress={submit} disabled={submitting} />
    </AppScreen>
  );
}

export function AdminDashboardScreen({ navigation }: any) {
  const { adminToken, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    api.adminDashboard(adminToken)
      .then(setDashboard)
      .catch((err) => setError(err?.message ?? "Không tải được dashboard"))
      .finally(() => setLoading(false));
  }, [adminToken]);

  if (loading) {
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
          <AppText variant="title">Dashboard</AppText>
          <AppText muted>Số liệu tổng quan hệ thống</AppText>
        </View>
        <AppButton label="Đăng xuất" size="sm" variant="ghost" onPress={signOut} />
      </View>
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {dashboard ? (
        <>
          <View style={styles.grid}>
            <StatCard label="Tổng user" value={dashboard.totals.users} />
            <StatCard label="Tổng bài đăng" value={dashboard.totals.posts} />
            <StatCard label="User mới hôm nay" value={dashboard.today.users} />
            <StatCard label="Bài đăng hôm nay" value={dashboard.today.posts} />
            <StatCard label="Tương tác hôm nay" value={dashboard.today.interactions} />
            <StatCard label="Like / Save / Comment" value={dashboard.today.likes + dashboard.today.saves + dashboard.today.comments} />
          </View>
          <AppButton label="Quản lý user" onPress={() => navigation.navigate("AdminUsers")} />
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

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    try {
      const result = await api.adminUsers(adminToken, { q: query.trim() || undefined, limit: 30 });
      setUsers(result.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [adminToken]);

  return (
    <AppScreen style={styles.wrap}>
      <View style={styles.headerRow}>
        <AppText variant="title">Quản lý user</AppText>
        <AppButton label="Dashboard" size="sm" variant="ghost" onPress={() => navigation.navigate("AdminDashboard")} />
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField label="Tìm kiếm" value={query} onChangeText={setQuery} placeholder="Tên, email, SĐT" />
        </View>
        <AppButton label="Tìm" size="sm" onPress={load} disabled={loading} />
      </View>
      {loading ? <ActivityIndicator color={colors.green} /> : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.userCard} onPress={() => navigation.navigate("AdminUserDetail", { id: item.id })}>
            <View style={styles.headerRow}>
              <View>
                <AppText variant="subtitle">{item.displayName}</AppText>
                <AppText muted>{item.email || item.phone || item.id}</AppText>
              </View>
              <AppText variant="caption" style={item.isPremium ? styles.premium : styles.badge}>
                {item.isPremium ? "Premium" : "Free"}
              </AppText>
            </View>
            <AppText muted>
              Posts {item.stats.posts} · Followers {item.stats.followers} · Following {item.stats.following} · Reports {item.stats.reports}
            </AppText>
            <AppText variant="caption" muted>
              Tạo: {formatDate(item.createdAt)}
            </AppText>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

export function AdminUserDetailScreen({ route, navigation }: any) {
  const { adminToken } = useAuth();
  const [user, setUser] = useState<AdminUserDetail | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    api.adminUser(adminToken, route.params.id).then((result) => setUser(result.user));
  }, [adminToken, route.params.id]);

  if (!user) {
    return (
      <AppScreen>
        <ActivityIndicator color={colors.green} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll scrollProps={{ contentContainerStyle: styles.wrap }}>
      <View style={styles.headerRow}>
        <AppText variant="title">{user.displayName}</AppText>
        <AppButton label="Quay l?i" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
      <AppText muted>{user.email || user.phone || user.id}</AppText>
      <View style={styles.grid}>
        <StatCard label="Bài đăng" value={user.stats.posts} />
        <StatCard label="Follower" value={user.stats.followers} />
        <StatCard label="Following" value={user.stats.following} />
        <StatCard label="Report" value={user.stats.reports} />
      </View>
      <View style={styles.card}>
        <AppText variant="subtitle">Thông tin</AppText>
        <AppText>Premium: {user.isPremium ? "Có" : "Không"}</AppText>
        <AppText>Bio: {user.bio || "—"}</AppText>
        <AppText>Tạo: {formatDate(user.createdAt)}</AppText>
        <AppText>Cập nhật: {formatDate(user.updatedAt)}</AppText>
      </View>
      <View style={styles.card}>
        <AppText variant="subtitle">Bài đăng gần đây</AppText>
        {user.recentPosts.map((post) => (
          <AppText key={post.id}>• {post.caption || "(Không caption)"} · {formatDate(post.createdAt)}</AppText>
        ))}
      </View>
      <View style={styles.card}>
        <AppText variant="subtitle">Tương tác admin cần chú ý</AppText>
        {user.interactions.length ? (
          user.interactions.map((interaction) => (
            <AppText key={interaction.id}>• {interaction.type}: {interaction.note || "—"}</AppText>
          ))
        ) : (
          <AppText muted>Không có dữ liệu.</AppText>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingBottom: 28 },
  loginWrap: { gap: 16, justifyContent: "center", minHeight: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, minWidth: 150, flex: 1 },
  userCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8, marginBottom: 12 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  searchInput: { flex: 1 },
  badge: { backgroundColor: colors.canvasStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  premium: { backgroundColor: colors.yellow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  error: { color: colors.red }
});