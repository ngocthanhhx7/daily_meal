import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import type { Post, User } from "../types/api";

type ProfileTab = "posts" | "saved";

function mediaSource(url?: string) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("http")) {
    return { uri: url };
  }

  return { uri: `${api.baseUrl}${url}` };
}

function postImageSource(post: Post) {
  return mediaSource(post.images[0]?.url) ?? require("../../assets/figma-snapshots/image3.png");
}

function birthdayText(user: User | null) {
  if (!user?.birthday?.date) {
    return "Chưa thêm ngày sinh";
  }

  const [year, month, day] = user.birthday.date.split("-");

  if (user.birthday.visibility === "hidden") {
    return `${day}/${month}/${year} · đang ẩn`;
  }

  if (user.birthday.visibility === "dayMonth") {
    return `${day}/${month} · chỉ hiển thị ngày tháng`;
  }

  return `${day}/${month}/${year} · hiển thị đầy đủ`;
}

export function ProfileScreen({ navigation }: any) {
  const { token, user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<ProfileTab>("posts");

  useEffect(() => {
    if (!token || !user?.id) {
      return;
    }

    Promise.all([api.getUserPosts(token, user.id), api.getUserSavedPosts(token, user.id)])
      .then(([postsResult, savedResult]) => {
        setPosts(postsResult.posts);
        setSavedPosts(savedResult.posts);
      })
      .catch(() => undefined);
  }, [token, user?.id]);

  const stats = [
    { label: "Bài viết", value: user?.counts?.posts ?? posts.length },
    { label: "Theo dõi", value: user?.counts?.followers ?? 0 },
    { label: "Đang theo", value: user?.counts?.following ?? 0 },
    { label: "Bạn bè", value: user?.counts?.friends ?? 0 }
  ];
  const currentPosts = tab === "posts" ? posts : savedPosts;

  return (
    <AppScreen>
      <View style={styles.navRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <AppText variant="subtitle" style={styles.navTitle}>Hồ sơ</AppText>
        <View style={styles.navBack} />
      </View>
      <View style={styles.coverWrap}>
        <Image
          source={mediaSource(user?.coverUrl) ?? require("../../assets/figma-snapshots/image3.png")}
          style={styles.cover}
        />
        <View style={styles.avatar}>
          {mediaSource(user?.avatarUrl) ? (
            <Image source={mediaSource(user?.avatarUrl)} style={styles.avatarImage} />
          ) : (
            <AppText variant="title" style={styles.avatarText}>
              {user?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.nameBlock}>
          <AppText variant="title" numberOfLines={2}>
            {user?.displayName ?? "Trang cá nhân"}
          </AppText>
          <AppText muted numberOfLines={2}>
            {user?.bio || "Chia sẻ bữa ăn và công thức mỗi ngày."}
          </AppText>
        </View>
        <View style={styles.badge}>
          <AppText variant="caption">{user?.isPremium ? "Premium" : "Free"}</AppText>
        </View>
      </View>

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <AppText variant="subtitle">{stat.value}</AppText>
            <AppText variant="caption" muted>
              {stat.label}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
        <AppText muted style={styles.infoCardText}>
          {birthdayText(user)}
        </AppText>
      </View>

      <View style={styles.actionGrid}>
        <AppButton label="Chỉnh sửa hồ sơ" onPress={() => navigation.navigate("EditProfile")} style={styles.actionButton} />
        <AppButton label="Tin nhắn" variant="ghost" onPress={() => navigation.navigate("Inbox")} style={styles.actionButton} />
      </View>
      <View style={styles.actionGrid}>
        <AppButton label="Đổi mật khẩu" variant="ghost" onPress={() => navigation.navigate("ChangePassword")} style={styles.actionButton} />
        <AppButton label="Cài đặt" variant="ghost" onPress={() => navigation.navigate("Settings")} style={styles.actionButton} />
      </View>
      <AppButton label="Đăng xuất" variant="danger" onPress={signOut} />

      <View style={styles.tabBar}>
        <ProfileTabButton active={tab === "posts"} icon="grid" onPress={() => setTab("posts")} />
        <ProfileTabButton active={tab === "saved"} icon="bookmark" onPress={() => setTab("saved")} />
      </View>

      {currentPosts.length ? (
        <View style={styles.grid}>
          {currentPosts.map((post) => (
            <Pressable
              key={post._id}
              style={styles.gridItem}
              onPress={() =>
                tab === "posts"
                  ? navigation.navigate("EditPost", { post })
                  : navigation.navigate("Recipe", { post })
              }
            >
              <Image source={postImageSource(post)} style={styles.gridImage} />
              <View style={styles.gridCaption}>
                <AppText variant="caption" numberOfLines={1}>
                  {post.caption || post.recipe?.title || "Bữa ăn"}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title={tab === "posts" ? "Chưa có bài viết" : "Chưa có bài đã lưu"}
          message={tab === "posts" ? "Tạo bài viết đầu tiên để chia sẻ." : "Các bài bạn lưu sẽ xuất hiện ở đây."}
          actionLabel={tab === "posts" ? "Đăng ảnh" : undefined}
          onAction={() => navigation.navigate("Create")}
          icon={tab === "posts" ? "camera-outline" : "bookmark-outline"}
        />
      )}
    </AppScreen>
  );
}

function ProfileTabButton({
  active,
  icon,
  onPress
}: {
  active: boolean;
  icon: "grid" | "bookmark";
  onPress: () => void;
}) {
  const iconName = (active ? icon : `${icon}-outline`) as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Ionicons name={iconName} size={20} color={colors.black} />
      {active ? <View style={styles.tabIndicator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  navTitle: { flex: 1, textAlign: "center" },
  coverWrap: {
    height: 190,
    borderRadius: 8,
    marginBottom: 28
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  avatar: {
    position: "absolute",
    left: 18,
    bottom: -34,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.canvas,
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: colors.white
  },
  profileHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  nameBlock: {
    flex: 1,
    gap: 5
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.yellow
  },
  stats: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 2
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  infoCardText: {
    flex: 1
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 42,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.black
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  gridItem: {
    width: "48%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  gridImage: {
    width: "100%",
    aspectRatio: 0.82,
    backgroundColor: colors.canvasStrong
  },
  gridCaption: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 8,
    paddingVertical: 4
  }
});
