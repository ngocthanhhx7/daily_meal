import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { AppButton } from "../components/AppButton";
import { EmptyState } from "../components/EmptyState";
import { StaggerItem, BouncePress } from "../components/Animations";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { User } from "../types/api";

type FollowTab = "followers" | "following";

function avatarSource(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:")) {
    return { uri: url };
  }
  return { uri: `${api.baseUrl}${url}` };
}

function followLabel(user: User) {
  if (user.relationship?.isFriend) return "Bạn bè";
  if (user.relationship?.isFollowing) return "Đang theo dõi";
  if (user.relationship?.followsMe) return "Theo dõi lại";
  return "Theo dõi";
}

export function FollowsScreen({ route, navigation }: any) {
  const { token, user: currentUser, refreshUser } = useAuth();
  const userId = route.params?.userId || currentUser?.id;
  const initialTab = (route.params?.initialTab || "followers") as FollowTab;
  const displayName = route.params?.displayName || "";

  const [activeTab, setActiveTab] = useState<FollowTab>(initialTab);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);

  // Fetch the target user profile if we don't have their name
  useEffect(() => {
    if (!token || !userId) return;
    if (userId === currentUser?.id) {
      setUserProfile(currentUser);
      return;
    }

    api.getUser(token, userId)
      .then((res) => setUserProfile(res.user))
      .catch((err) => console.error("Failed to fetch user profile:", err));
  }, [token, userId, currentUser]);

  // Fetch the list whenever tab changes
  useEffect(() => {
    if (!token || !userId) return;

    let isMounted = true;
    setLoading(true);

    const fetchPromise = activeTab === "followers"
      ? api.getUserFollowers(token, userId)
      : api.getUserFollowing(token, userId);

    fetchPromise
      .then((res) => {
        if (isMounted) {
          setUsers(res.users);
        }
      })
      .catch((err) => {
        console.error(`Failed to fetch ${activeTab}:`, err);
        if (isMounted) {
          Alert.alert("Lỗi", "Không thể tải danh sách người dùng.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, userId, activeTab]);

  async function toggleFollow(target: User) {
    if (!token) return;
    try {
      const result = target.relationship?.isFollowing
        ? await api.unfollowUser(token, target.id)
        : await api.followUser(token, target.id);
      
      // Update local state for the modified user
      setUsers((current) =>
        current.map((item) => (item.id === target.id ? result.user : item))
      );
      await refreshUser();
    } catch (error) {
      Alert.alert(
        "Không thể cập nhật theo dõi",
        error instanceof Error ? error.message : "Thử lại sau"
      );
    }
  }

  function handleUserPress(targetUser: User) {
    if (targetUser.id === currentUser?.id) {
      navigation.navigate("Profile");
    } else {
      navigation.navigate("PublicProfile", { userId: targetUser.id });
    }
  }

  const titleText = userProfile
    ? userProfile.id === currentUser?.id
      ? "Hồ sơ của tôi"
      : userProfile.displayName
    : displayName || "Danh sách";

  return (
    <AppScreen>
      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <BouncePress style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.black} />
          </BouncePress>
          <AppText variant="title" style={styles.headerTitle} numberOfLines={1}>
            {titleText}
          </AppText>
        </View>
      </View>

      {/* Segment control tabs */}
      <View style={styles.segment}>
        <BouncePress
          onPress={() => setActiveTab("followers")}
          style={[styles.segmentItem, activeTab === "followers" && styles.segmentItemActive]}
        >
          <AppText
            variant="button"
            style={activeTab === "followers" ? styles.segmentLabelActive : styles.segmentLabel}
          >
            Người theo dõi
          </AppText>
        </BouncePress>
        <BouncePress
          onPress={() => setActiveTab("following")}
          style={[styles.segmentItem, activeTab === "following" && styles.segmentItemActive]}
        >
          <AppText
            variant="button"
            style={activeTab === "following" ? styles.segmentLabelActive : styles.segmentLabel}
          >
            Đang theo dõi
          </AppText>
        </BouncePress>
      </View>

      {/* List content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.green} size="large" />
          <AppText muted>Đang tải danh sách...</AppText>
        </View>
      ) : users.length ? (
        <View style={styles.listContainer}>
          {users.map((item, index) => (
            <StaggerItem key={item.id} index={index}>
              <View style={styles.userRow}>
                <Pressable
                  style={styles.userInfo}
                  onPress={() => handleUserPress(item)}
                >
                  <View style={styles.avatar}>
                    {avatarSource(item.avatarUrl) ? (
                      <Image source={avatarSource(item.avatarUrl)} style={styles.avatarImage} />
                    ) : (
                      <AppText variant="caption" style={styles.avatarText}>
                        {item.displayName.slice(0, 1).toUpperCase()}
                      </AppText>
                    )}
                  </View>
                  <View style={styles.userCopy}>
                    <AppText variant="button" numberOfLines={1}>
                      {item.displayName}
                    </AppText>
                    <AppText variant="caption" muted numberOfLines={1}>
                      {item.bio || `${item.counts?.followers ?? 0} người theo dõi`}
                    </AppText>
                  </View>
                </Pressable>
                
                {/* Do not show follow button for self */}
                {item.id !== currentUser?.id && (
                  <AppButton
                    label={followLabel(item)}
                    variant={item.relationship?.isFollowing ? "ghost" : "primary"}
                    onPress={() => toggleFollow(item)}
                    size="sm"
                    style={styles.followButton}
                  />
                )}
              </View>
            </StaggerItem>
          ))}
        </View>
      ) : (
        <EmptyState
          title={activeTab === "followers" ? "Chưa có người theo dõi" : "Chưa theo dõi ai"}
          message={
            activeTab === "followers"
              ? "Tương tác và chia sẻ nhiều hơn để mọi người tìm thấy bạn."
              : "Khám phá những người sáng tạo khác tại màn hình Tìm kiếm."
          }
          icon={activeTab === "followers" ? "people-outline" : "person-add-outline"}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 4
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.black
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 12
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  segmentItemActive: {
    backgroundColor: colors.black
  },
  segmentLabel: {
    color: colors.muted
  },
  segmentLabelActive: {
    color: colors.white
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40
  },
  listContainer: {
    gap: 12,
    paddingBottom: 32
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.green,
    flexShrink: 0
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.semibold
  },
  userCopy: {
    flex: 1,
    minWidth: 0
  },
  followButton: {
    flexShrink: 0
  }
});
