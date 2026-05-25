import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { AppButton } from "../components/AppButton";
import { AppScreen } from "../components/AppScreen";
import { AppText } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { PostCard } from "../components/PostCard";
import { TextField } from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { demoPosts } from "../data/sample";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { Post, User } from "../types/api";

type SearchMode = "posts" | "people";

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
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialQuery = route?.params?.initialQuery;
    const initialMode = route?.params?.initialMode as SearchMode | undefined;

    if (typeof initialQuery === "string" && initialQuery !== query) {
      setQuery(initialQuery);
      setMode(initialMode ?? "people");
      if (token) {
        runSearch(initialQuery, initialMode ?? "people");
      }
    }
  }, [route?.params?.initialQuery, route?.params?.initialMode, token]);

  async function search() {
    await runSearch(query, mode);
  }

  async function runSearch(searchQuery: string, currentMode: SearchMode) {
    if (!token) return;
    setLoading(true);
    try {
      const [postResult, userResult] = await Promise.all([
        api.search(token, searchQuery),
        api.searchUsers(token, searchQuery)
      ]);
      setPosts(postResult.posts);
      setUsers(userResult.users);
      if (currentMode === "posts" && !postResult.posts.length && userResult.users.length) {
        setMode("people");
      }
    } catch (error) {
      Alert.alert("Không thể tìm kiếm", error instanceof Error ? error.message : "Thử lại sau");
    } finally {
      setLoading(false);
    }
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
        <AppText variant="title">Tìm kiếm</AppText>
        <AppText muted>Tìm món ăn, nguyên liệu, người dùng hoặc thẻ.</AppText>
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
        <Pressable style={styles.searchButton} onPress={search}>
          {loading
            ? <Ionicons name="reload-outline" size={20} color={colors.white} />
            : <Ionicons name="search" size={20} color={colors.white} />
          }
        </Pressable>
      </View>

      {/* Quick filters */}
      <View style={styles.filters}>
        {["Dưới 500 calo", "Đã lưu", "Sticker VIP"].map((filter) => (
          <Pressable key={filter} style={styles.filter} onPress={search}>
            <AppText variant="caption">{filter}</AppText>
          </Pressable>
        ))}
      </View>

      {/* Segment control */}
      <View style={styles.segment}>
        {(["posts", "people"] as SearchMode[]).map((seg) => (
          <Pressable
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
          </Pressable>
        ))}
      </View>

      {/* Results */}
      {mode === "people" ? (
        users.length ? (
          users.map((item) => (
            <View key={item.id} style={styles.userRow}>
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
          ))
        ) : (
          <EmptyState
            title="Không có người dùng"
            message="Nhập tên, email hoặc bio để tìm người khác."
            icon="people-outline"
          />
        )
      ) : posts.length ? (
        posts.map((post) => (
          <PostCard
            key={post._id}
            post={post}
            token={token}
            onAuthorPress={() =>
              navigation.navigate("PublicProfile", { userId: post.author.id })
            }
            onCommentPress={() => navigation.navigate("Comments", { post })}
            onRecipePress={() => navigation.navigate("Recipe", { post })}
          />
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
    gap: 4
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
    width: 48,
    height: 48,
    borderRadius: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line
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
