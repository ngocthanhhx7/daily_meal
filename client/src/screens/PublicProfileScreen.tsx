import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import {
  COMPACT_POST_CARD_WIDTH,
  COMPACT_POST_GRID_MAX_WIDTH,
  CompactPostPreview
} from "../components/CompactPostPreview";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { demoUser } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, User } from "../types/api";
import { getPublicProfilePostTarget } from "../utils/postNavigation";

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

function profileHandle(profile: User) {
  const base = profile.displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();

  return `@${base || profile.email?.split("@")[0] || profile.phone || "daily.meal"}`;
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
    <AppScreen style={styles.screen} scrollProps={{ contentContainerStyle: styles.scrollContent }}>
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

        <View style={styles.summaryContent}>
          <AppText variant="button" style={styles.displayName} numberOfLines={1}>
            {profile.displayName}
          </AppText>
          <View style={styles.stats}>
            <StatItem label="Bài viết" value={profile.counts?.posts ?? posts.length} />
            <StatItem
              label="Theo dõi"
              value={profile.counts?.followers ?? 0}
              onPress={() =>
                navigation.navigate("Follows", {
                  userId: profile.id,
                  initialTab: "followers",
                  displayName: profile.displayName
                })
              }
            />
            <StatItem
              label="Đang Theo Dõi"
              value={profile.counts?.following ?? 0}
              onPress={() =>
                navigation.navigate("Follows", {
                  userId: profile.id,
                  initialTab: "following",
                  displayName: profile.displayName
                })
              }
            />
          </View>
        </View>
      </View>

      <View style={styles.bioBlock}>
        <AppText style={styles.bioText} numberOfLines={2}>
          <AppText style={styles.handleText}>{profileHandle(profile)}</AppText>
          {` ${profile.bio || "Daily Meal creator chia sẻ món ngon mỗi ngày."}`}
        </AppText>
        {publicBirthday ? (
          <AppText variant="caption" muted>
            {publicBirthday}
          </AppText>
        ) : null}
      </View>

      {profile.id !== user?.id ? (
        <View style={styles.actionRow}>
          <ProfileActionButton
            label={followLabel(profile)}
            variant={profile.relationship?.isFollowing ? "light" : "blue"}
            onPress={toggleFollow}
            loading={loadingFollow}
            disabled={profile.viewerInteraction?.blocked}
          />
          <ProfileActionButton
            label="Nhắn tin"
            variant="light"
            onPress={openChat}
            disabled={profile.viewerInteraction?.blocked}
          />
        </View>
      ) : (
        <ProfileActionButton
          label="Đây là hồ sơ của bạn"
          variant="light"
          onPress={() => navigation.navigate("MainTabs", { screen: "Profile" })}
        />
      )}

      <View style={styles.tabBar}>
        <ProfileTabButton active={tab === "posts"} icon="grid" onPress={() => setTab("posts")} />
        <ProfileTabButton active={tab === "saved"} icon="bookmark" onPress={() => setTab("saved")} />
      </View>

      {currentPosts.length ? (
        <View style={styles.grid}>
          {currentPosts.map((post, index) => (
            <Pressable
              key={post._id}
              style={[styles.gridItem, index % 2 === 1 && styles.gridItemLower]}
              onPress={() => {
                const target = getPublicProfilePostTarget(tab, post);
                navigation.navigate(target.screen, target.params);
              }}
            >
              <CompactPostPreview post={post} captionSide={index % 2 === 0 ? "left" : "right"} />
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

function ProfileActionButton({
  label,
  variant,
  onPress,
  loading,
  disabled
}: {
  label: string;
  variant: "blue" | "light";
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isBlue = variant === "blue";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileActionButton,
        isBlue ? styles.profileActionBlue : styles.profileActionLight,
        (pressed || disabled) && styles.profileActionDisabled
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isBlue ? colors.white : colors.ink} />
      ) : (
        <AppText
          variant="button"
          numberOfLines={1}
          style={isBlue ? styles.profileActionBlueText : styles.profileActionLightText}
        >
          {label}
        </AppText>
      )}
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
    color: colors.green,
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
    gap: 28
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
    minHeight: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4
  },
  profileActionBlue: {
    backgroundColor: "#5DA4FF"
  },
  profileActionLight: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)"
  },
  profileActionDisabled: {
    opacity: 0.6
  },
  profileActionBlueText: {
    color: colors.white,
    fontFamily: fonts.semibold
  },
  profileActionLightText: {
    color: colors.black,
    fontFamily: fonts.semibold
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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38
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
    alignSelf: "center",
    width: "100%",
    maxWidth: COMPACT_POST_GRID_MAX_WIDTH,
    rowGap: 14,
    paddingHorizontal: 2,
    paddingBottom: 24
  },
  gridItem: {
    width: COMPACT_POST_CARD_WIDTH,
    maxWidth: "46%",
    borderRadius: 20,
    backgroundColor: "transparent",
    overflow: "visible"
  },
  gridItemLower: {
    marginTop: 18
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
    display: "none",
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
