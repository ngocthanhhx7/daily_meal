import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types/api";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  savePreferences: (interests: string[], eatingStyles: string[]) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_KEY = "daily-meal-token";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!savedToken) {
          return;
        }
        const result = await api.me(savedToken);
        if (mounted) {
          setToken(savedToken);
          setUser(result.user);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
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
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
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
      register: async (email, password, displayName) => {
        const result = await api.register({ email, password, displayName });
        await persistSession(result.token, result.user);
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setUser(null);
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
