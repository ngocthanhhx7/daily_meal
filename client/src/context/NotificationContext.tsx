import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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

function notificationUrl(notification: Notification) {
  const params = new URLSearchParams({ notificationId: notification._id });

  if (notification.type === "follow" && notification.sender?._id) {
    params.set("screen", "PublicProfile");
    params.set("userId", notification.sender._id);
  } else if (notification.type === "message") {
    params.set("screen", "Inbox");
  } else if (notification.post?._id) {
    params.set("screen", notification.type === "like" ? "Recipe" : "Comments");
    params.set("postId", notification.post._id);
  } else {
    params.set("screen", "Notifications");
  }

  return `/?${params.toString()}`;
}

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

  const applyNotifications = useCallback((nextNotifications: Notification[]) => {
    setNotifications(nextNotifications);
    setUnreadCount(nextNotifications.filter((n) => !n.read).length);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      applyNotifications([]);
      return;
    }

    try {
      const result = await api.notifications(token);
      applyNotifications(result.notifications);
    } catch (err) {
      console.error("❌ Failed to refresh notifications:", err);
    }
  }, [applyNotifications, token]);

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
      applyNotifications([]);
      return;
    }

    refreshNotifications();
  }, [applyNotifications, refreshNotifications, token]);

  useEffect(() => {
    if (!token) return;

    if (Platform.OS === "web") {
      const onFocus = () => refreshNotifications();
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          refreshNotifications();
        }
      };

      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }

    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications, token]);

  // Listen for real-time notification socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("notification:created", (newNotification: Notification) => {
      console.log("🔔 Real-time notification received via socket:", newNotification);
      setNotifications((current) => {
        if (current.some((item) => item._id === newNotification._id)) {
          return current.map((item) => (item._id === newNotification._id ? newNotification : item));
        }

        return [newNotification, ...current];
      });
      setUnreadCount((current) => current + (newNotification.read ? 0 : 1));

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
                  vibrate: [200, 100, 200],
                  data: { url: notificationUrl(newNotification) }
                } as any);
              })
              .catch((err) => {
                console.error("SW ready failed, falling back to legacy Notification", err);
                new window.Notification("Daily Meal 🍽️", {
                  body: newNotification.body,
                  icon: newNotification.sender.avatarUrl || "/favicon.png",
                  data: { url: notificationUrl(newNotification) } as any
                });
              });
          } else {
            new window.Notification("Daily Meal 🍽️", {
              body: newNotification.body,
              icon: newNotification.sender.avatarUrl || "/favicon.png",
              data: { url: notificationUrl(newNotification) } as any
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
