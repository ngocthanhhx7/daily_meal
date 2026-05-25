import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { demoUser } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
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

function profileHandle(profile: User) {
  const base = profile.displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();

  return `@${base || profile.email.split("@")[0]}`;
}

function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

function followLabel(profile: User) {
  if (profile.viewerInteraction?.blocked) {
    return "Đã chặn";
  }

  if (profile.relationship?.isFriend) {
    return "Bạn bè";
  }

  if (profile.relationship?.isFollowing) {
    return "Đang theo dõi";
  }

  if (profile.relationship?.followsMe) {
    return "Theo dõi lại";
  }

  return "Theo dõi";
}

function birthdayText(profile: User) {
  const birthday = profile.birthday;

  if (!birthday || birthday.visibility === "hidden") {
    return "";
  }

  if (birthday.visibility === "dayMonth" && birthday.day && birthday.month) {
    return `Sinh nhật ${birthday.day}/${birthday.month}`;
  }

  if (birthday.date) {
    const [year, month, day] = birthday.date.split("-");
    return `Sinh nhật ${day}/${month}/${year}`;
  }

  return "";
}

export function PublicProfileScreen({ route, navigation }: any) {
  const { token, user, refreshUser } = useAuth();
  const userId = route.params?.userId;
  const [profile, setProfile] = useState<User>(demoUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const publicBirthday = birthdayText(profile);

  useEffect(() => {
    if (!token || !userId || userId === "demo-user") {
      return;
    }

    Promise.all([
      api.getUser(token, userId),
      api.getUserPosts(token, userId),
      api.getUserSavedPosts(token, userId)
    ])
      .then(([userResult, postsResult, savedResult]) => {
        setProfile(userResult.user);
        setPosts(postsResult.posts);
        setSavedPosts(savedResult.posts);
      })
      .catch(() => undefined);
  }, [token, userId]);

  async function toggleFollow() {
    if (!token || !profile.id || profile.id === user?.id || profile.viewerInteraction?.blocked) {
      return;
    }

    setLoadingFollow(true);
    try {
      const result = profile.relationship?.isFollowing
        ? await api.unfollowUser(token, profile.id)
        : await api.followUser(token, profile.id);
      setProfile(result.user);
      await refreshUser();
    } catch (error) {
      Alert.alert("Không thể cập nhật theo dõi", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoadingFollow(false);
    }
  }

  async function openChat() {
    if (!token || !profile.id || profile.viewerInteraction?.blocked) {
      return;
    }

    try {
      const result = await api.createConversation(token, profile.id);
      navigation.navigate("Chat", {
        conversationId: result.conversation.id,
        otherUser: result.conversation.otherUser
      });
    } catch (error) {
      Alert.alert("Không thể mở tin nhắn", error instanceof Error ? error.message : "Thử lại sau");
    }
  }

  async function setInteraction(type: "restrict" | "block" | "report") {
    if (!token || !profile.id) {
      return;
    }

    setMenuOpen(false);
    try {
      const current = profile.viewerInteraction;
      const isActive =
        type === "restrict" ? current?.restricted : type === "block" ? current?.blocked : current?.reported;

      if (isActive && type !== "report") {
        await api.removeUserInteraction(token, profile.id, type);
      } else {
        await api.setUserInteraction(token, profile.id, type);
      }

      const result = await api.getUser(token, profile.id);
      setProfile(result.user);
      Alert.alert("Đã cập nhật", actionDoneText(type, Boolean(isActive)));
    } catch (error) {
      Alert.alert("Không thể cập nhật", error instanceof Error ? error.message : "Thử lại sau");
    }
  }

  function actionDoneText(type: "restrict" | "block" | "report", wasActive: boolean) {
    if (type === "restrict") {
      return wasActive ? "Đã bỏ hạn chế người dùng này." : "Đã hạn chế người dùng này.";
    }

    if (type === "block") {
      return wasActive ? "Đã bỏ chặn người dùng này." : "Đã chặn người dùng này.";
    }

    return "Đã gửi báo cáo để xử lý sau.";
  }

  function copyNameToSearch() {
    setMenuOpen(false);
    navigation.navigate("MainTabs", {
      screen: "Search",
      params: { initialQuery: profile.displayName, initialMode: "people" }
    });
  }

  const currentPosts = tab === "posts" ? posts : savedPosts;

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
        <AppText variant="title" style={styles.profileTitle} numberOfLines={1}>
          {profile.displayName}
        </AppText>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={26} color={colors.black} />
        </Pressable>
      </View>

      <View style={styles.profileSummary}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {mediaSource(profile.avatarUrl) ? (
              <Image source={mediaSource(profile.avatarUrl)} style={styles.avatarImage} />
            ) : (
              <AppText variant="title" style={styles.avatarText}>
                {profile.displayName.slice(0, 1).toUpperCase()}
              </AppText>
            )}
          </View>
          {profile.isPremium ? (
            <View style={styles.premiumBadge}>
              <AppText variant="caption" style={styles.premiumText}>P</AppText>
            </View>
          ) : null}
        </View>

      <View style={styles.profileHeader}>
        <View style={styles.nameBlock}>
          <AppText variant="title" numberOfLines={2}>
            {profile.displayName}
          </AppText>
          <AppText muted numberOfLines={2}>
            {profile.bio || "Daily Meal creator"}
          </AppText>
          {publicBirthday ? <AppText variant="caption">{publicBirthday}</AppText> : null}
        </View>
        <View style={styles.badge}>
          <AppText variant="caption">{profile.isPremium ? "Premium" : "Free"}</AppText>
        </View>
      </View>

      <View style={styles.stats}>
        <StatItem label="Bài viết" value={profile.counts?.posts ?? posts.length} />
        <StatItem label="Theo dõi" value={profile.counts?.followers ?? 0} />
        <StatItem label="Đang theo" value={profile.counts?.following ?? 0} />
        <StatItem label="Bạn bè" value={profile.counts?.friends ?? 0} />
      </View>

      {profile.id !== user?.id ? (
        <View style={styles.actionRow}>
          <AppButton
            label={followLabel(profile)}
            variant={profile.relationship?.isFollowing ? "ghost" : "primary"}
            onPress={toggleFollow}
            loading={loadingFollow}
            style={styles.actionButton}
          />
          <AppButton
            label="Nhắn tin"
            variant="secondary"
            onPress={openChat}
            disabled={profile.viewerInteraction?.blocked}
            style={styles.actionButton}
          />
        </View>
      ) : (
        <AppButton
          label="Đây là hồ sơ của bạn"
          variant="ghost"
          onPress={() => navigation.navigate("MainTabs", { screen: "Profile" })}
        />
      )}

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
              onPress={() => navigation.navigate("Recipe", { post })}
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
          message={tab === "posts" ? "Người dùng này chưa đăng công khai." : "Chưa có bài lưu công khai để xem."}
          icon={tab === "posts" ? "grid-outline" : "bookmark-outline"}
        />
      )}

      <ProfileActionMenu
        visible={menuOpen}
        profile={profile}
        onClose={() => setMenuOpen(false)}
        onRestrict={() => setInteraction("restrict")}
        onBlock={() => setInteraction("block")}
        onCopyName={copyNameToSearch}
        onReport={() => setInteraction("report")}
      />
    </AppScreen>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <AppText variant="subtitle">{value}</AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
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

function ProfileActionMenu({
  visible,
  profile,
  onClose,
  onRestrict,
  onBlock,
  onCopyName,
  onReport
}: {
  visible: boolean;
  profile: User;
  onClose: () => void;
  onRestrict: () => void;
  onBlock: () => void;
  onCopyName: () => void;
  onReport: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.menuSheet}>
          <MenuItem
            icon="remove-circle-outline"
            label={profile.viewerInteraction?.restricted ? "Bỏ hạn chế" : "Hạn chế"}
            onPress={onRestrict}
          />
          <MenuItem
            icon="ban-outline"
            label={profile.viewerInteraction?.blocked ? "Bỏ chặn" : "Chặn"}
            danger
            onPress={onBlock}
          />
          <MenuItem icon="search-outline" label="Sao chép tên để tìm kiếm" onPress={onCopyName} />
          <MenuItem icon="flag-outline" label="Báo cáo" danger onPress={onReport} />
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
  coverWrap: {
    height: 190,
    borderRadius: 8,
    overflow: "visible",
    marginBottom: 28
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  topActions: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.86)"
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
    alignItems: "flex-start",
    gap: 12
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
  actionRow: {
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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
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
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 8,
    paddingVertical: 4
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
