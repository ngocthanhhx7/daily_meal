import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, Share, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, User } from "../types/api";

type ProfileTab = "posts" | "saved";

function mediaSource(url?: string) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:") || url.startsWith("blob:")) {
    return { uri: url };
  }

  if (url.includes("assets/") || url.includes("cute_")) {
    const name = url.split("/").pop()?.replace(".png", "");
    switch (name) {
      case "cute_cat": return require("../../assets/avatar/cute_cat.png");
      case "cute_dog": return require("../../assets/avatar/cute_dog.png");
      case "cute_rabbit": return require("../../assets/avatar/cute_rabbit.png");
      case "cute_bear": return require("../../assets/avatar/cute_bear.png");
      case "cute_hamster": return require("../../assets/avatar/cute_hamster.png");
      case "cute_panda": return require("../../assets/avatar/cute_panda.png");
      case "cute_dino": return require("../../assets/avatar/cute_dino.png");
      case "cute_koala": return require("../../assets/avatar/cute_koala.png");
      case "cute_penguin": return require("../../assets/avatar/cute_penguin.png");
      case "cute_fox": return require("../../assets/avatar/cute_fox.png");
      default: break;
    }
  }

  return { uri: `${api.baseUrl}${url}` };
}

function postImageSource(post: Post) {
  return mediaSource(post.images[0]?.url) ?? require("../../assets/figma-snapshots/image3.png");
}

function profileHandle(user: User | null) {
  if (!user) {
    return "@daily.meal";
  }

  const base = user.displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();

  return `@${base || user.email?.split("@")[0] || user.phone || "daily.meal"}`;
}

function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

export function ProfileScreen({ navigation }: any) {
  const { token, user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [menuOpen, setMenuOpen] = useState(false);

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

  const currentPosts = tab === "posts" ? posts : savedPosts;

  function shareProfile() {
    Share.share({
      title: user?.displayName ?? "Daily Meal",
      message: `${user?.displayName ?? "Daily Meal"} trên Daily Meal ${profileHandle(user)}`
    }).catch(() => undefined);
  }

  function navigateFromMenu(screen: string) {
    setMenuOpen(false);
    navigation.navigate(screen);
  }

  async function signOutFromMenu() {
    setMenuOpen(false);
    await signOut();
  }

  return (
    <AppScreen style={styles.screen} scrollProps={{ contentContainerStyle: styles.scrollContent }}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
        <AppText variant="title" style={styles.profileTitle} numberOfLines={1}>
          {user?.displayName ?? "Hồ sơ"}
        </AppText>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)} hitSlop={8}>
          <Group116046807Icon />
        </Pressable>
      </View>

      <View style={styles.profileSummary}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {mediaSource(user?.avatarUrl) ? (
              <Image source={mediaSource(user?.avatarUrl)} style={styles.avatarImage} />
            ) : (
              <AppText variant="title" style={styles.avatarText}>
                {user?.displayName?.slice(0, 1)?.toUpperCase() ?? "D"}
              </AppText>
            )}
          </View>
          {user?.isPremium ? (
            <View style={styles.premiumBadge}>
              <AppText variant="caption" style={styles.premiumText}>P</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryContent}>
          <AppText variant="button" style={styles.displayName} numberOfLines={1}>
            {user?.displayName ?? "Daily Meal"}
          </AppText>
          <View style={styles.stats}>
            <StatItem label="Bài viết" value={user?.counts?.posts ?? posts.length} />
            <StatItem
              label="Theo dõi"
              value={user?.counts?.followers ?? 0}
              onPress={() =>
                navigation.navigate("Follows", {
                  userId: user?.id,
                  initialTab: "followers",
                  displayName: user?.displayName
                })
              }
            />
            <StatItem
              label="Đang Theo Dõi"
              value={user?.counts?.following ?? 0}
              onPress={() =>
                navigation.navigate("Follows", {
                  userId: user?.id,
                  initialTab: "following",
                  displayName: user?.displayName
                })
              }
            />
          </View>
        </View>
      </View>

      <View style={styles.bioBlock}>
        <AppText style={styles.bioText} numberOfLines={2}>
          <AppText style={styles.handleText}>{profileHandle(user)}</AppText>
          {` ${user?.bio || "Daily Meal creator chia sẻ món ngon mỗi ngày."}`}
        </AppText>
      </View>

      <View style={styles.actionRow}>
        <ProfileActionButton label="Chỉnh sửa trang" onPress={() => navigation.navigate("EditProfile")} />
        <ProfileActionButton label="Chia sẻ trang" onPress={shareProfile} />
      </View>

      <View style={styles.tabBar}>
        <ProfileTabButton active={tab === "posts"} icon="grid" onPress={() => setTab("posts")} />
        <ProfileTabButton active={tab === "saved"} icon="bookmark" onPress={() => setTab("saved")} />
      </View>

      {currentPosts.length ? (
        <View style={styles.grid}>
          {currentPosts.map((post, index) => (
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
              <View style={[styles.gridCaption, index % 2 === 0 ? { left: 8 } : { right: 8 }]}>
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

      <ProfileMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onInbox={() => navigateFromMenu("Inbox")}
        onChangePassword={() => navigateFromMenu("ChangePassword")}
        onSettings={() => navigateFromMenu("Settings")}
        onSignOut={signOutFromMenu}
      />
    </AppScreen>
  );
}

function Group116046807Icon() {
  return (
    <View style={styles.dotsIcon} accessibilityLabel="Group116046807">
      <View style={styles.dot} />
      <View style={styles.dot} />
      <View style={styles.dot} />
    </View>
  );
}

function ProfileActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileActionButton, pressed && styles.profileActionPressed]}
    >
      <AppText variant="button" numberOfLines={1} style={styles.profileActionText}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StatItem({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const Container = onPress ? Pressable : View;
  const displayValue = Math.max(0, value);
  return (
    <Container style={styles.statItem} onPress={onPress}>
      <AppText style={styles.statValue}>{formatCount(displayValue)}</AppText>
      <AppText style={styles.statLabel} numberOfLines={1}>
        {label}
      </AppText>
    </Container>
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
      <Ionicons name={iconName} size={22} color={colors.black} />
      {active ? <View style={styles.tabIndicator} /> : null}
    </Pressable>
  );
}

function ProfileMenu({
  visible,
  onClose,
  onInbox,
  onChangePassword,
  onSettings,
  onSignOut
}: {
  visible: boolean;
  onClose: () => void;
  onInbox: () => void;
  onChangePassword: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.menuSheet}>
          <MenuItem icon="chatbubble-ellipses-outline" label="Tin nhắn" onPress={onInbox} />
          <MenuItem icon="key-outline" label="Đổi mật khẩu" onPress={onChangePassword} />
          <MenuItem icon="settings-outline" label="Cài đặt" onPress={onSettings} />
          <MenuItem icon="log-out-outline" label="Đăng xuất" danger onPress={onSignOut} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.red : colors.ink} />
      <AppText variant="button" style={danger ? styles.dangerText : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: 10,
    gap: 14
  },
  scrollContent: {
    overflow: "hidden"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingHorizontal: 2
  },
  backButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  profileTitle: {
    flex: 1,
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    marginHorizontal: 8
  },
  menuButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  dotsIcon: {
    width: 26,
    height: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.black
  },
  profileSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 2
  },
  avatarWrap: {
    width: 78,
    height: 78
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: colors.white
  },
  premiumBadge: {
    position: "absolute",
    top: 0,
    right: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.white
  },
  premiumText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12
  },
  summaryContent: {
    flex: 1,
    minWidth: 0,
    gap: 7
  },
  displayName: {
    color: colors.black,
    fontFamily: fonts.semibold
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 80
  },
  statItem: {
    alignItems: "flex-start",
    minWidth: 0,
    gap: 1
  },
  statValue: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
    textAlign: "left"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "left"
  },
  bioBlock: {
    gap: 3,
    paddingHorizontal: 2
  },
  bioText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  },
  handleText: {
    color: "#A342FF",
    fontFamily: fonts.regular
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    paddingHorizontal: 2
  },
  profileActionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4
  },
  profileActionPressed: {
    opacity: 0.72
  },
  profileActionText: {
    color: colors.black,
    fontFamily: fonts.semibold,
    fontSize: 14
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 42,
    marginTop: 2,
    marginBottom: -2
  },
  tabButton: {
    width: 68,
    minHeight: 38,
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
    justifyContent: "space-between",
    rowGap: 18,
    paddingHorizontal: 2,
    paddingBottom: 24
  },
  gridItem: {
    width: "47.5%",
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 5,
    overflow: "visible"
  },
  gridImage: {
    width: "100%",
    aspectRatio: 0.78,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  gridCaption: {
    position: "absolute",
    top: 10,
    maxWidth: "86%",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 11,
    paddingVertical: 5
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.32)"
  },
  menuSheet: {
    margin: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden"
  },
  menuItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  dangerText: {
    color: colors.red
  }
});
