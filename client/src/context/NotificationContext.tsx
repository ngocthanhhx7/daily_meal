import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Configure notification handler for native apps (foreground notifications)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
}

type Notification = {
  _id: string;
  user: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  type: "like" | "comment" | "follow" | "message";
  post?: any;
  comment?: any;
  body: string;
  read: boolean;
  createdAt: string;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Request browser desktop notification permissions on web load
  useEffect(() => {
    if (Platform.OS === "web" && "Notification" in window) {
      if (window.Notification.permission === "default") {
        window.Notification.requestPermission().catch(() => undefined);
      }
    }
  }, []);

  // Register Native Push Notification Token
  useEffect(() => {
    if (!token || Platform.OS === "web") return;

    const currentToken = token;
    let isMounted = true;
    let registeredToken: string | null = null;

    async function registerPush() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("⚠️ Push notification permission not granted.");
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoToken = tokenResponse.data;

        if (isMounted && expoToken) {
          console.log("📲 Registering Expo Push Token on server:", expoToken);
          registeredToken = expoToken;
          await api.registerPushToken(currentToken, expoToken);
        }
      } catch (error) {
        console.error("❌ Failed to register push token on server:", error);
      }
    }

    registerPush();

    return () => {
      isMounted = false;
      const tok = token;
      const regTok = registeredToken;
      if (tok && regTok) {
        api.unregisterPushToken(tok, regTok).catch((err) => {
          console.error("❌ Failed to unregister push token:", err);
        });
      }
    };
  }, [token]);

  // Listen for native notification interactions (click/response)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("🔔 Native Foreground Notification Received:", notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("👉 Native Notification Clicked:", response);
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Fetch initial notifications when authenticated
  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    api
      .notifications(token)
      .then((result) => {
        setNotifications(result.notifications);
        setUnreadCount(result.notifications.filter((n: Notification) => !n.read).length);
      })
      .catch((err) => console.error("❌ Failed to fetch notifications:", err));
  }, [token]);

  // Listen for real-time notification socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("notification:created", (newNotification: Notification) => {
      console.log("🔔 Real-time notification received via socket:", newNotification);
      setNotifications((current) => [newNotification, ...current]);
      setUnreadCount((current) => current + 1);

      // Trigger browser notification if supported and allowed
      if (Platform.OS === "web" && "Notification" in window && window.Notification.permission === "granted") {
        try {
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready
              .then((registration) => {
                registration.showNotification("Daily Meal 🍽️", {
                  body: newNotification.body,
                  icon: newNotification.sender.avatarUrl || "/favicon.png",
                  badge: "/favicon.png",
                  vibrate: [200, 100, 200]
                } as any);
              })
              .catch((err) => {
                console.error("SW ready failed, falling back to legacy Notification", err);
                new window.Notification("Daily Meal 🍽️", {
                  body: newNotification.body,
                  icon: newNotification.sender.avatarUrl || "/favicon.png"
                });
              });
          } else {
            new window.Notification("Daily Meal 🍽️", {
              body: newNotification.body,
              icon: newNotification.sender.avatarUrl || "/favicon.png"
            });
          }
        } catch (e) {
          console.error("Failed to show HTML5 notification", e);
        }
      }
    });

    return () => {
      socket.off("notification:created");
    };
  }, [socket]);

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      const result = await api.markNotificationRead(token, id);
      setNotifications((current) =>
        current.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      console.error(`❌ Failed to mark notification ${id} as read:`, err);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await api.markAllNotificationsRead(token);
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("❌ Failed to mark all notifications as read:", err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider");
  }
  return context;
}
