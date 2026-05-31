import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";
import type { User } from "../types/api";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string, password: string) => Promise<void>;
  requestPhoneOtp: (phone: string) => Promise<{ requiresPasswordSetup: boolean; devOtp?: string }>;
  verifyPhoneOtp: (phone: string, otp: string, password?: string, displayName?: string) => Promise<void>;
  signInWithFacebook: (facebookToken: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  registerWithPhone: (phone: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkGoogle: (idToken: string) => Promise<void>;
  savePreferences: (interests: string[], eatingStyles: string[]) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_KEY = "daily-meal-token";
const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error("Failed to get item from localStorage", e);
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error("Failed to get item from SecureStore", e);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        console.error("Failed to set item in localStorage", e);
        return;
      }
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error("Failed to set item in SecureStore", e);
    }
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
        return;
      } catch (e) {
        console.error("Failed to delete item from localStorage", e);
        return;
      }
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error("Failed to delete item from SecureStore", e);
    }
  }
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      try {
        const savedToken = await safeStorage.getItem(TOKEN_KEY);
        if (!savedToken) {
          return;
        }
        const result = await api.me(savedToken);
        if (mounted) {
          setToken(savedToken);
          setUser(result.user);
        }
      } catch {
        await safeStorage.deleteItem(TOKEN_KEY);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    restore();
    return () => {
      mounted = false;
    };
  }, []);

  async function persistSession(nextToken: string, nextUser: User) {
    await safeStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      signIn: async (email, password) => {
        const result = await api.login({ email, password });
        await persistSession(result.token, result.user);
      },
      signInWithPhone: async (phone, password) => {
        const result = await api.loginWithPhone({ phone, password });
        await persistSession(result.token, result.user);
      },
      requestPhoneOtp: async (phone) => {
        const result = await api.requestPhoneOtp({ phone });
        return {
          requiresPasswordSetup: result.requiresPasswordSetup,
          devOtp: result.devOtp
        };
      },
      verifyPhoneOtp: async (phone, otp, password, displayName) => {
        const result = await api.verifyPhoneOtp({ phone, otp, password, displayName });
        await persistSession(result.token, result.user);
      },
      signInWithFacebook: async (facebookToken) => {
        const result = await api.loginWithFacebook(facebookToken);
        await persistSession(result.token, result.user);
      },
      signInWithGoogle: async (idToken) => {
        const result = await api.googleLogin({ idToken });
        await persistSession(result.token, result.user);
      },
      register: async (email, password, displayName) => {
        const result = await api.register({ email, password, displayName });
        await persistSession(result.token, result.user);
      },
      registerWithPhone: async (phone, password, displayName) => {
        const result = await api.registerWithPhone({ phone, password, displayName });
        await persistSession(result.token, result.user);
      },
      signOut: async () => {
        await safeStorage.deleteItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
      linkGoogle: async (idToken) => {
        if (!token) {
          return;
        }
        const result = await api.linkGoogle(token, { idToken });
        setUser(result.user);
      },
      savePreferences: async (interests, eatingStyles) => {
        if (!token || !user) {
          return;
        }
        const result = await api.savePreferences(token, { interests, eatingStyles });
        setUser({ ...user, preferences: result.preferences });
      },
      updateUser: async (patch) => {
        if (!token) {
          return;
        }
        const result = await api.updateMe(token, patch);
        setUser(result.user);
      },
      refreshUser: async () => {
        if (!token) {
          return;
        }
        const result = await api.me(token);
        setUser(result.user);
      }
    }),
    [isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
