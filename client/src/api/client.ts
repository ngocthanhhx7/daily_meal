import { NativeModules, Platform } from "react-native";
import type {
  AdminDashboard,
  AdminAnalytics24h,
  AdminAnalytics24hPreset,
  AdminAnalyticsHeatmap,
  AdminPostInsights,
  AdminPostMediaKind,
  AdminPostSortBy,
  AdminPayment,
  AdminPagination,
  AdminPostSummary,
  AdminRangePreset,
  AdminReport,
  AdminReportItem,
  AdminSortOrder,
  AdminUserDetail,
  AdminUserInsights,
  AdminUserSummary,
  ChatMessage,
  Conversation,
  Meal,
  PayosPayment,
  Post,
  PostSummaryFilter,
  PremiumPlan,
  Sticker,
  Upload,
  User
} from "../types/api";

declare const process: {
  env: Record<string, string | undefined>;
};

declare const __DEV__: boolean;

const PRODUCTION_API_BASE_URL = "https://api.dailymeal.site";

function isLocalDevelopmentUrl(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/.*)?$/i.test(value);
}

function getMetroHost() {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const host = scriptURL?.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1];

  if (!host || host === "localhost" || host === "127.0.0.1") {
    return undefined;
  }

  return host;
}

function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    if (!__DEV__ && Platform.OS !== "web" && isLocalDevelopmentUrl(process.env.EXPO_PUBLIC_API_URL)) {
      return PRODUCTION_API_BASE_URL;
    }

    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  if (!__DEV__) {
    return PRODUCTION_API_BASE_URL;
  }

  const metroHost = getMetroHost();

  if (metroHost) {
    return `http://${metroHost}:4000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://localhost:4000";
}

const API_BASE_URL = resolveApiBaseUrl();

type ApiOptions = {
  token?: string | null;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

type MealAnalyzeHints = {
  ingredientsText?: string;
};

type ApiTelemetryEvent = {
  path: string;
  method: string;
  status?: number;
  durationMs: number;
  ok: boolean;
};

type SearchParams = {
  q?: string;
  maxCalories?: number;
  saved?: boolean;
  premiumSticker?: boolean;
  personalized?: boolean;
};

let telemetryReporter: ((event: ApiTelemetryEvent) => void) | undefined;

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function searchQueryString(input?: string | SearchParams) {
  const params = new URLSearchParams();
  const body = typeof input === "string" ? { q: input } : input ?? {};
  if (body.q !== undefined) params.set("q", body.q);
  if (body.maxCalories !== undefined) params.set("maxCalories", String(body.maxCalories));
  if (body.saved !== undefined) params.set("saved", String(body.saved));
  if (body.premiumSticker !== undefined) params.set("premiumSticker", String(body.premiumSticker));
  if (body.personalized !== undefined) params.set("personalized", String(body.personalized));
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

function userSearchQueryString(input?: string | Pick<SearchParams, "q" | "personalized">) {
  const params = new URLSearchParams();
  const body = typeof input === "string" ? { q: input } : input ?? {};
  if (body.q !== undefined) params.set("q", body.q);
  if (body.personalized !== undefined) params.set("personalized", String(body.personalized));
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {})
  };

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const method = options.method ?? "GET";
  const startedAt = nowMs();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body
  }).catch((error) => {
    telemetryReporter?.({ path, method, durationMs: Math.max(0, nowMs() - startedAt), ok: false });
    throw new Error(
      `Không kết nối được API tại ${API_BASE_URL}. Kiểm tra server và cùng mạng Wi-Fi. ${
        error instanceof Error ? error.message : ""
      }`
    );
  });

  telemetryReporter?.({
    path,
    method,
    status: response.status,
    durationMs: Math.max(0, nowMs() - startedAt),
    ok: response.ok
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  setTelemetryReporter: (reporter?: (event: ApiTelemetryEvent) => void) => {
    telemetryReporter = reporter;
  },
  adminLogin: (body: { email: string; password: string }) =>
    request<{ token: string; admin: { email: string; displayName: string } }>("/api/admin/login", {
      method: "POST",
      body
    }),
  adminDashboard: (token: string, params?: { range?: AdminRangePreset; start?: string; end?: string; startTime?: string; endTime?: string }) => {
    const search = new URLSearchParams();
    if (params?.range) search.set("range", params.range);
    if (params?.start) search.set("start", params.start);
    if (params?.end) search.set("end", params.end);
    if (params?.startTime) search.set("startTime", params.startTime);
    if (params?.endTime) search.set("endTime", params.endTime);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminDashboard>(`/api/admin/dashboard${suffix}`, { token });
  },
  adminAnalyticsSummary: (token: string, params?: { range?: AdminRangePreset; start?: string; end?: string; startTime?: string; endTime?: string }) => {
    const search = new URLSearchParams();
    if (params?.range) search.set("range", params.range);
    if (params?.start) search.set("start", params.start);
    if (params?.end) search.set("end", params.end);
    if (params?.startTime) search.set("startTime", params.startTime);
    if (params?.endTime) search.set("endTime", params.endTime);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ summary: AdminDashboard["analytics"] }>(`/api/admin/analytics/summary${suffix}`, { token });
  },
  adminAnalytics24h: (token: string, params?: { preset?: AdminAnalytics24hPreset; from?: string; to?: string; timezone?: string; eventTypes?: string }) => {
    const search = new URLSearchParams();
    if (params?.preset) search.set("preset", params.preset);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.timezone) search.set("timezone", params.timezone);
    if (params?.eventTypes) search.set("eventTypes", params.eventTypes);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminAnalytics24h>(`/api/admin/analytics/24h${suffix}`, { token });
  },
  adminAnalyticsHeatmap: (token: string, params?: { preset?: AdminAnalytics24hPreset; from?: string; to?: string; timezone?: string; metric?: string }) => {
    const search = new URLSearchParams();
    if (params?.preset) search.set("preset", params.preset);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.timezone) search.set("timezone", params.timezone);
    if (params?.metric) search.set("metric", params.metric);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminAnalyticsHeatmap>(`/api/admin/analytics/heatmap${suffix}`, { token });
  },
  adminAiReport: (token: string, body?: { range?: AdminRangePreset; start?: string; end?: string }) =>
    request<AdminReport>("/api/admin/reports/ai", {
      method: "POST",
      token,
      body: body ?? {}
    }),
  adminUsers: (token: string, params?: { q?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ users: AdminUserSummary[]; pagination: AdminPagination }>(`/api/admin/users${suffix}`, { token });
  },
  adminUserInsights: (token: string, params?: { range?: AdminRangePreset; start?: string; end?: string; startTime?: string; endTime?: string }) => {
    const search = new URLSearchParams();
    if (params?.range) search.set("range", params.range);
    if (params?.start) search.set("start", params.start);
    if (params?.end) search.set("end", params.end);
    if (params?.startTime) search.set("startTime", params.startTime);
    if (params?.endTime) search.set("endTime", params.endTime);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminUserInsights>(`/api/admin/users/insights${suffix}`, { token });
  },
  adminUser: (token: string, id: string) => request<{ user: AdminUserDetail }>(`/api/admin/users/${id}`, { token }),
  adminSetUserPremium: (token: string, id: string, body: { isPremium: boolean; note?: string }) =>
    request<{ user: AdminUserSummary }>(`/api/admin/users/${id}/premium`, {
      method: "PATCH",
      token,
      body
    }),
  adminPosts: (token: string, params?: {
    q?: string;
    page?: number;
    limit?: number;
    moderationStatus?: "visible" | "hidden" | "review";
    visibility?: "public" | "friends" | "private";
    range?: AdminRangePreset;
    start?: string;
    end?: string;
    mediaKind?: AdminPostMediaKind;
    sortBy?: AdminPostSortBy;
    sortOrder?: AdminSortOrder;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.moderationStatus) search.set("moderationStatus", params.moderationStatus);
    if (params?.visibility) search.set("visibility", params.visibility);
    if (params?.range) search.set("range", params.range);
    if (params?.start) search.set("start", params.start);
    if (params?.end) search.set("end", params.end);
    if (params?.mediaKind) search.set("mediaKind", params.mediaKind);
    if (params?.sortBy) search.set("sortBy", params.sortBy);
    if (params?.sortOrder) search.set("sortOrder", params.sortOrder);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ posts: AdminPostSummary[]; pagination: AdminPagination }>(`/api/admin/posts${suffix}`, { token });
  },
  adminPostInsights: (token: string, params?: {
    q?: string;
    range?: AdminRangePreset;
    start?: string;
    end?: string;
    mediaKind?: AdminPostMediaKind;
    sortBy?: AdminPostSortBy;
    sortOrder?: AdminSortOrder;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.range) search.set("range", params.range);
    if (params?.start) search.set("start", params.start);
    if (params?.end) search.set("end", params.end);
    if (params?.mediaKind) search.set("mediaKind", params.mediaKind);
    if (params?.sortBy) search.set("sortBy", params.sortBy);
    if (params?.sortOrder) search.set("sortOrder", params.sortOrder);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<AdminPostInsights>(`/api/admin/posts/insights${suffix}`, { token });
  },
  adminModeratePost: (token: string, id: string, body: { moderationStatus: "visible" | "hidden" | "review"; reason?: string }) =>
    request<{ post: AdminPostSummary }>(`/api/admin/posts/${id}/moderation`, {
      method: "PATCH",
      token,
      body
    }),
  adminReports: (token: string, params?: { status?: "open" | "resolved" | "dismissed" | "all"; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ reports: AdminReportItem[]; pagination: AdminPagination }>(`/api/admin/reports${suffix}`, { token });
  },
  adminUpdateReport: (token: string, id: string, body: { status: "open" | "resolved" | "dismissed"; adminNote?: string }) =>
    request<{ report: AdminReportItem }>(`/api/admin/reports/${id}`, {
      method: "PATCH",
      token,
      body
    }),
  adminPayments: (token: string, params?: { q?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ payments: AdminPayment[]; pagination: AdminPagination }>(`/api/admin/payments${suffix}`, { token });
  },
  baseUrl: API_BASE_URL,
  register: (body: { email: string; password: string; displayName?: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body
    }),
  registerWithPhone: (body: { phone: string; password: string; displayName?: string }) =>
    request<{ token: string; user: User }>("/api/auth/phone/register", {
      method: "POST",
      body
    }),
  loginWithPhone: (body: { phone: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/phone/login", {
      method: "POST",
      body
    }),
  requestPhoneOtp: (body: { phone: string }) =>
    request<{ message: string; requiresPasswordSetup: boolean; devOtp?: string }>("/api/auth/phone/request-otp", {
      method: "POST",
      body
    }),
  verifyPhoneOtp: (body: { phone: string; otp: string; password?: string; displayName?: string }) =>
    request<{ token: string; user: User }>("/api/auth/phone/verify-otp", {
      method: "POST",
      body
    }),
  requestPasswordResetOtp: (body: { email: string }) =>
    request<{ message: string; devOtp?: string }>("/api/auth/password/forgot/request-otp", {
      method: "POST",
      body
    }),
  verifyPasswordResetOtp: (body: { email: string; otp: string; newPassword?: string }) =>
    request<{ token: string; user: User; message: string }>("/api/auth/password/forgot/verify-otp", {
      method: "POST",
      body
    }),
  loginWithFacebook: (accessToken: string) =>
    request<{ token: string; user: User }>("/api/auth/facebook", {
      method: "POST",
      body: { accessToken }
    }),
  googleLogin: (body: { idToken: string }) =>
    request<{ token: string; user: User }>("/api/auth/google", {
      method: "POST",
      body
    }),
  linkGoogle: (token: string, body: { idToken: string }) =>
    request<{ user: User }>("/api/auth/google/link", {
      method: "POST",
      token,
      body
    }),
  me: (token: string) => request<{ user: User }>("/api/auth/me", { token }),
  savePreferences: (
    token: string,
    body: { interests: string[]; eatingStyles: string[] }
  ) =>
    request<{ preferences: User["preferences"] }>("/api/onboarding/preferences", {
      method: "PATCH",
      token,
      body
    }),
  updateMe: (token: string, body: Partial<Omit<User, "isPremium">>) =>
    request<{ user: User }>("/api/users/me", {
      method: "PATCH",
      token,
      body
    }),
  premiumPlans: () => request<{ plans: PremiumPlan[] }>("/api/payments/premium/plans"),
  createPayosPremiumPayment: (token: string, body: { planId: PremiumPlan["id"] }) =>
    request<PayosPayment>("/api/payments/payos/create", {
      method: "POST",
      token,
      body
    }),
  payosPayment: (token: string, orderCode: number) =>
    request<PayosPayment>(`/api/payments/payos/${orderCode}`, { token }),
  changePassword: (token: string, body: { currentPassword: string; newPassword: string }) =>
    request<void>("/api/auth/password", {
      method: "PATCH",
      token,
      body
    }),
  searchUsers: (token: string, query?: string | Pick<SearchParams, "q" | "personalized">) =>
    request<{ users: User[] }>(`/api/users/search${userSearchQueryString(query)}`, { token }),
  getBlockedUsers: (token: string) =>
    request<{ users: User[] }>("/api/users/me/interactions/blocked", { token }),
  getUser: (token: string, id: string) => request<{ user: User }>(`/api/users/${id}`, { token }),
  getUserFollowers: (token: string, id: string) =>
    request<{ users: User[] }>(`/api/users/${id}/followers`, { token }),
  getUserFollowing: (token: string, id: string) =>
    request<{ users: User[] }>(`/api/users/${id}/following`, { token }),
  getUserPosts: (token: string, id: string) =>
    request<{ posts: Post[] }>(`/api/users/${id}/posts`, { token }),
  getUserSavedPosts: (token: string, id: string) =>
    request<{ posts: Post[] }>(`/api/users/${id}/saved-posts`, { token }),
  followUser: (token: string, id: string) =>
    request<{ user: User }>(`/api/users/${id}/follow`, {
      method: "POST",
      token
    }),
  unfollowUser: (token: string, id: string) =>
    request<{ user: User }>(`/api/users/${id}/follow`, {
      method: "DELETE",
      token
    }),
  setUserInteraction: (token: string, id: string, type: "restrict" | "block" | "report", note?: string) =>
    request<{ type: string; active: boolean }>(`/api/users/${id}/interactions`, {
      method: "POST",
      token,
      body: { type, note }
    }),
  removeUserInteraction: (token: string, id: string, type: "restrict" | "block" | "report") =>
    request<{ type: string; active: boolean }>(`/api/users/${id}/interactions/${type}`, {
      method: "DELETE",
      token
    }),
  conversations: (token: string) =>
    request<{ conversations: Conversation[] }>("/api/messages/conversations", { token }),
  createConversation: (token: string, recipientId: string) =>
    request<{ conversation: Conversation }>("/api/messages/conversations", {
      method: "POST",
      token,
      body: { recipientId }
    }),
  conversationMessages: (token: string, conversationId: string) =>
    request<{ messages: ChatMessage[] }>(`/api/messages/conversations/${conversationId}/messages`, { token }),
  sendMessage: (token: string, conversationId: string, body: string) =>
    request<{ message: ChatMessage }>(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      token,
      body: { body }
    }),
  feed: (token: string, page?: number, limit?: number) => {
    const search = new URLSearchParams();
    if (page) search.set("page", String(page));
    if (limit) search.set("limit", String(limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ posts: Post[] }>(`/api/posts/feed${suffix}`, { token });
  },
  postSummary: (token: string, filter: PostSummaryFilter, page?: number, limit?: number) => {
    const search = new URLSearchParams();
    search.set("filter", filter);
    if (page) search.set("page", String(page));
    if (limit) search.set("limit", String(limit));
    return request<{ posts: Post[]; page: number; limit: number; hasMore: boolean }>(
      `/api/posts/summary?${search.toString()}`,
      { token }
    );
  },
  search: (token: string, query?: string | SearchParams) =>
    request<{ posts: Post[] }>(`/api/posts/search${searchQueryString(query)}`, { token }),
  createPost: (token: string, body: Record<string, unknown>) =>
    request<{ post: Post }>("/api/posts", {
      method: "POST",
      token,
      body
    }),
  updatePost: (token: string, postId: string, body: Record<string, unknown>) =>
    request<{ post: Post }>(`/api/posts/${postId}`, {
      method: "PATCH",
      token,
      body
    }),
  deletePost: (token: string, postId: string) =>
    request<void>(`/api/posts/${postId}`, {
      method: "DELETE",
      token
    }),
  likePost: (token: string, postId: string) =>
    request<{ liked: boolean; stats: Post["stats"] }>(`/api/posts/${postId}/like`, {
      method: "POST",
      token
    }),
  savePost: (token: string, postId: string) =>
    request<{ saved: boolean; stats: Post["stats"] }>(`/api/posts/${postId}/save`, {
      method: "POST",
      token
    }),
  comments: (token: string, postId: string) =>
    request<{ comments: unknown[] }>(`/api/posts/${postId}/comments`, { token }),
  addComment: (token: string, postId: string, body: string) =>
    request<{ comment: unknown }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      token,
      body: { body }
    }),
  stickers: (token: string) => request<{ stickers: Sticker[] }>("/api/stickers", { token }),
  createSticker: (token: string, body: { name: string; assetPath: string; key: string }) =>
    request<{ sticker: Sticker }>("/api/stickers", {
      method: "POST",
      token,
      body
    }),
  uploadImage: async (token: string, uri: string, category: string) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        form.append("image", blob, `${category}-${Date.now()}.jpg`);
      } catch (error) {
        console.error("Failed to convert URI to blob on web", error);
        throw new Error("Không thể xử lý dữ liệu ảnh trên trình duyệt.");
      }
    } else {
      form.append("image", {
        uri,
        name: `${category}-${Date.now()}.jpg`,
        type: "image/jpeg"
      } as unknown as Blob);
    }
    return request<{ upload: Upload }>(`/api/uploads?category=${category}`, {
      method: "POST",
      token,
      body: form
    });
  },
  uploadVideo: async (token: string, uri: string, category: string) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        form.append("video", blob, `${category}-${Date.now()}.mp4`);
      } catch (error) {
        console.error("Failed to convert URI to blob on web", error);
        throw new Error("Không thể xử lý dữ liệu video trên trình duyệt.");
      }
    } else {
      form.append("video", {
        uri,
        name: `${category}-${Date.now()}.mp4`,
        type: "video/mp4"
      } as unknown as Blob);
    }
    return request<{ upload: Upload }>(`/api/uploads?category=${category}`, {
      method: "POST",
      token,
      body: form
    });
  },
  analyzeMeal: (token: string, uploadId: string, hints?: MealAnalyzeHints) =>
    request<{ meal: Meal }>("/api/meals/analyze", {
      method: "POST",
      token,
      body: hints ? { uploadId, hints } : { uploadId }
    }),
  meals: (token: string) => request<{ meals: Meal[] }>("/api/meals", { token }),
  notifications: (token: string) =>
    request<{ notifications: any[] }>("/api/notifications", { token }),
  markNotificationRead: (token: string, id: string) =>
    request<{ notification: any }>(`/api/notifications/${id}/read`, {
      method: "PATCH",
      token
    }),
  markAllNotificationsRead: (token: string) =>
    request<void>("/api/notifications/read-all", {
      method: "PATCH",
      token
    }),
  deleteNotification: (token: string, id: string) =>
    request<void>(`/api/notifications/${id}`, {
      method: "DELETE",
      token
    }),
  deleteAllNotifications: (token: string) =>
    request<void>("/api/notifications", {
      method: "DELETE",
      token
    }),
  registerPushToken: (token: string, pushToken: string) =>
    request<{ success: boolean }>("/api/users/push-token", {
      method: "POST",
      token,
      body: { pushToken }
    }),
  unregisterPushToken: (token: string, pushToken: string) =>
    request<{ success: boolean }>("/api/users/push-token", {
      method: "DELETE",
      token,
      body: { pushToken }
    }),
  webPushVapidPublicKey: () =>
    request<{ publicKey: string }>("/api/users/web-push/vapid-public-key"),
  registerWebPushSubscription: (token: string, subscription: PushSubscriptionJSON) =>
    request<{ success: boolean }>("/api/users/web-push-subscription", {
      method: "POST",
      token,
      body: subscription
    }),
  unregisterWebPushSubscription: (token: string, endpoint: string) =>
    request<{ success: boolean }>("/api/users/web-push-subscription", {
      method: "DELETE",
      token,
      body: { endpoint }
    }),
  claimPremiumTrial: (token: string) =>
    request<{ user: User }>("/api/users/me/premium-trial", {
      method: "POST",
      token
    })
};
