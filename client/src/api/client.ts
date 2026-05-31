import { NativeModules, Platform } from "react-native";
import type { ChatMessage, Conversation, Meal, Post, Sticker, Upload, User } from "../types/api";

declare const process: {
  env: Record<string, string | undefined>;
};

function getMetroHost() {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const host = scriptURL?.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1];

  if (!host || host === "localhost" || host === "127.0.0.1") {
    return undefined;
  }

  return host;
}

function resolveApiBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body
  }).catch((error) => {
    throw new Error(
      `Không kết nối được API tại ${API_BASE_URL}. Kiểm tra server và cùng mạng Wi-Fi. ${
        error instanceof Error ? error.message : ""
      }`
    );
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
  updateMe: (token: string, body: Partial<User>) =>
    request<{ user: User }>("/api/users/me", {
      method: "PATCH",
      token,
      body
    }),
  changePassword: (token: string, body: { currentPassword: string; newPassword: string }) =>
    request<void>("/api/auth/password", {
      method: "PATCH",
      token,
      body
    }),
  searchUsers: (token: string, query: string) =>
    request<{ users: User[] }>(`/api/users/search?q=${encodeURIComponent(query)}`, { token }),
  getUser: (token: string, id: string) => request<{ user: User }>(`/api/users/${id}`, { token }),
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
  feed: (token: string) => request<{ posts: Post[] }>("/api/posts/feed", { token }),
  search: (token: string, query: string) =>
    request<{ posts: Post[] }>(`/api/posts/search?q=${encodeURIComponent(query)}`, { token }),
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
  analyzeMeal: (token: string, uploadId: string) =>
    request<{ meal: Meal }>("/api/meals/analyze", {
      method: "POST",
      token,
      body: { uploadId }
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
    })
};
