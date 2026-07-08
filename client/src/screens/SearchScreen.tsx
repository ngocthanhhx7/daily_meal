import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { PostCard } from "../components/PostCard";
import { StaggerItem, BouncePress } from "../components/Animations";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, User } from "../types/api";

type SearchMode = "posts" | "people";
type SearchFilter = string;

function avatarSource(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${api.baseUrl}${url}` };
}

function followLabel(user: User) {
  if (user.relationship?.isFriend) return "Bạn bè";
  if (user.relationship?.isFollowing) return "Đang theo dõi";
  if (user.relationship?.followsMe) return "Theo dõi lại";
  return "Theo dõi";
}

export function SearchScreen({ navigation, route }: any) {
  const { token, refreshUser } = useAuth();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);

  useEffect(() => {
    const initialQuery = route?.params?.initialQuery;
    const initialMode = route?.params?.initialMode as SearchMode | undefined;

    if (typeof initialQuery === "string" && initialQuery !== query) {
      setQuery(initialQuery);
      setMode(initialMode ?? "people");
      if (token) {
        runSearch(initialQuery, initialMode ?? "people", activeFilters);
      }
    }
  }, [route?.params?.initialQuery, route?.params?.initialMode, token]);

  useEffect(() => {
    if (token && !route?.params?.initialQuery) {
      runSearch(query, mode, activeFilters);
    }
  }, [token]);

  async function search() {
    await runSearch(query, mode, activeFilters);
  }

  function searchParams(searchQuery: string, filters: SearchFilter[]) {
    return {
      q: searchQuery,
      maxCalories: filters.some((filter) => filter.includes("500")) ? 500 : undefined,
      saved: filters.some((filter) => !filter.includes("500") && !filter.includes("Sticker")) ? true : undefined,
      premiumSticker: filters.some((filter) => filter.includes("Sticker")) ? true : undefined
    };
  }

  async function runSearch(searchQuery: string, currentMode: SearchMode, filters: SearchFilter[]) {
    if (!token) return;
    setLoading(true);
    try {
      const [postResult, userResult] = await Promise.all([
        api.search(token, searchParams(searchQuery, filters)),
        api.searchUsers(token, { q: searchQuery })
      ]);
      setPosts(postResult.posts);
      setUsers(userResult.users);
      if (currentMode === "posts" && !postResult.posts.length && userResult.users.length) {
        setMode("people");
      } else if (currentMode === "people" && !userResult.users.length && postResult.posts.length) {
        setMode("posts");
      }
    } catch (error) {
      Alert.alert("Không thể tìm kiếm", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  function toggleFilter(filter: SearchFilter) {
    const nextFilters = activeFilters.includes(filter)
      ? activeFilters.filter((item) => item !== filter)
      : [...activeFilters, filter];
    setActiveFilters(nextFilters);
    runSearch(query, mode, nextFilters);
  }

  async function toggleFollow(target: User) {
    if (!token) return;
    try {
      const result = target.relationship?.isFollowing
        ? await api.unfollowUser(token, target.id)
        : await api.followUser(token, target.id);
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

  return (
    <AppScreen>
      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <BouncePress style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.black} />
          </BouncePress>
          <AppText variant="title" style={styles.headerTitle}>Tìm kiếm</AppText>
          <BouncePress style={styles.backBtn} onPress={() => navigation.navigate("Home")} hitSlop={10}>
            <Ionicons name="home-outline" size={24} color={colors.black} />
          </BouncePress>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles-outline" size={20} color={colors.greenDark} />
          </View>
          <View style={styles.heroCopy}>
            <AppText variant="button">Khám phá bữa ăn phù hợp</AppText>
            <AppText variant="caption" muted>Tìm món ăn, nguyên liệu, người dùng hoặc thẻ yêu thích.</AppText>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField
            label=""
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={search}
            placeholder="Tìm kiếm..."
            style={styles.inputField}
          />
        </View>
        <BouncePress style={styles.searchButton} onPress={search}>
          {loading
            ? <Ionicons name="reload-outline" size={20} color={colors.white} />
            : <Ionicons name="search" size={20} color={colors.white} />
          }
        </BouncePress>
      </View>

      {/* Quick filters */}
      <View style={styles.filters}>
        {["Dưới 500 calo", "Đã lưu", "Sticker VIP"].map((filter) => (
          <BouncePress
            key={filter}
            style={[styles.filter, activeFilters.includes(filter) && styles.filterActive]}
            onPress={() => toggleFilter(filter)}
          >
            <AppText
              variant="caption"
              style={activeFilters.includes(filter) ? styles.filterLabelActive : undefined}
            >
              {filter}
            </AppText>
          </BouncePress>
        ))}
      </View>

      {/* Segment control */}
      <View style={styles.segment}>
        {(["posts", "people"] as SearchMode[]).map((seg) => (
          <BouncePress
            key={seg}
            onPress={() => setMode(seg)}
            style={[styles.segmentItem, mode === seg && styles.segmentItemActive]}
          >
            <AppText
              variant="button"
              style={mode === seg ? styles.segmentLabelActive : styles.segmentLabel}
            >
              {seg === "posts" ? "Bài viết" : "Người dùng"}
            </AppText>
          </BouncePress>
        ))}
      </View>

      {/* Results */}
      {mode === "people" ? (
        users.length ? (
          users.map((item, index) => (
            <StaggerItem key={item.id} index={index}>
              <View style={styles.userRow}>
                <Pressable
                  style={styles.userInfo}
                  onPress={() => navigation.navigate("PublicProfile", { userId: item.id })}
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
                <AppButton
                  label={followLabel(item)}
                  variant={item.relationship?.isFollowing ? "ghost" : "primary"}
                  onPress={() => toggleFollow(item)}
                  size="sm"
                  style={styles.followButton}
                />
              </View>
            </StaggerItem>
          ))
        ) : (
          <EmptyState
            title="Không có người dùng"
            message="Nhập tên, email hoặc bio để tìm người khác."
            icon="people-outline"
          />
        )
      ) : posts.length ? (
        posts.map((post, index) => (
          <StaggerItem key={post._id} index={index}>
            <PostCard
              post={post}
              token={token}
              onAuthorPress={() =>
                navigation.navigate("PublicProfile", { userId: post.author.id })
              }
              onCommentPress={() => navigation.navigate("Comments", { post })}
              onRecipePress={() => navigation.navigate("Recipe", { post })}
            />
          </StaggerItem>
        ))
      ) : (
        <EmptyState
          title="Không có kết quả"
          message="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
          icon="search-outline"
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 12
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
    flex: 1
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F8F5E8",
    borderWidth: 1,
    borderColor: colors.line
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E8F0DE",
    alignItems: "center",
    justifyContent: "center"
  },
  heroCopy: {
    flex: 1,
    gap: 2
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end"
  },
  searchInput: {
    flex: 1
  },
  inputField: {
    marginTop: 0
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 0
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  filterActive: {
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  filterLabelActive: {
    color: colors.white
  },
  segment: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#EEEAE0",
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14
  },
  segmentItemActive: {
    backgroundColor: colors.black,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  segmentLabel: {
    color: colors.muted
  },
  segmentLabelActive: {
    color: colors.white
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
