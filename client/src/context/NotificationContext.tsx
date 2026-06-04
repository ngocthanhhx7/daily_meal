import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getPwaEnvironment } from "../pwa/platform";
import { getWebPushReadiness, urlBase64ToUint8Array, type WebPushReadiness } from "../pwa/webPush";

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
  } | null;
  type: "like" | "comment" | "follow" | "message";
  post?: any;
  comment?: any;
  body: string;
  read: boolean;
  createdAt: string;
};

type NotificationRoute = {
  screen: "PublicProfile" | "Inbox" | "Recipe" | "Comments" | "Notifications";
  userId?: string;
  postId?: string;
  notificationId: string;
};

type WebNotificationOptions = NotificationOptions & {
  vibrate?: number[];
};

function notificationRoute(notification: Notification): NotificationRoute {
  const route: NotificationRoute = {
    screen: "Notifications",
    notificationId: notification._id
  };

  if (notification.type === "follow" && notification.sender?._id) {
    return { ...route, screen: "PublicProfile", userId: notification.sender._id };
  }

  if (notification.type === "message") {
    return { ...route, screen: "Inbox" };
  }

  if (notification.post?._id) {
    return {
      ...route,
      screen: notification.type === "like" ? "Recipe" : "Comments",
      postId: notification.post._id
    };
  }

  return route;
}

function notificationUrl(notification: Notification) {
  const route = notificationRoute(notification);
  const params = new URLSearchParams({ notificationId: route.notificationId, screen: route.screen });

  if (route.userId) {
    params.set("userId", route.userId);
  }

  if (route.postId) {
    params.set("postId", route.postId);
  }

  return `/?${params.toString()}`;
}

function notificationTitle(notification: Notification) {
  const senderName = notification.sender?.displayName || "Daily Meal";

  if (notification.type === "like") return `Lượt thích mới từ ${senderName} ❤️`;
  if (notification.type === "comment") return `Bình luận mới từ ${senderName} 💬`;
  if (notification.type === "follow") return `${senderName} đã theo dõi bạn 👋`;
  if (notification.type === "message") return `Tin nhắn mới từ ${senderName} 💬`;

  return "Daily Meal 🍽️";
}

function notificationData(notification: Notification) {
  return {
    ...notificationRoute(notification),
    url: notificationUrl(notification),
    type: notification.type
  };
}

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  webPushStatus: WebPushReadiness;
  enableWebPushNotifications: () => Promise<WebPushReadiness>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [webPushStatus, setWebPushStatus] = useState<WebPushReadiness>("unsupported");
  const webPushEndpointRef = useRef<string | undefined>(undefined);

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

  const showDeviceNotification = useCallback(async (newNotification: Notification) => {
    const title = notificationTitle(newNotification);
    const data = notificationData(newNotification);

    if (Platform.OS === "web") {
      if (!("Notification" in window)) return;

      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission().catch(() => "denied" as NotificationPermission);
      }
      if (permission !== "granted") return;

      const options: WebNotificationOptions = {
        body: newNotification.body,
        icon: newNotification.sender?.avatarUrl || "/favicon.png",
        badge: "/favicon.png",
        vibrate: [200, 100, 200],
        data
      };

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
      } else {
        const browserNotification = new window.Notification(title, options);
        browserNotification.onclick = () => {
          window.focus();
          window.location.href = data.url;
          browserNotification.close();
        };
      }

      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: newNotification.body,
        data,
        sound: "default"
      },
      trigger: null
    });
  }, []);

  const registerWebPush = useCallback(
    async ({ requestPermission }: { requestPermission: boolean }): Promise<WebPushReadiness> => {
      if (!token || Platform.OS !== "web" || typeof window === "undefined") {
        setWebPushStatus("unsupported");
        return "unsupported";
      }

      const hasNotification = "Notification" in window;
      const hasServiceWorker = "serviceWorker" in navigator;
      const hasPushManager = "PushManager" in window;
      const environment = getPwaEnvironment();
      let publicKey = "";

      try {
        publicKey = (await api.webPushVapidPublicKey()).publicKey;
      } catch (error) {
        console.error("Failed to read Web Push VAPID public key", error);
      }

      let permission: NotificationPermission = hasNotification ? window.Notification.permission : "denied";
      let readiness = getWebPushReadiness({
        environment,
        hasNotification,
        hasServiceWorker,
        hasPushManager,
        permission,
        publicKey
      });

      if (readiness === "needs-permission" && requestPermission) {
        permission = await window.Notification.requestPermission();
        readiness = getWebPushReadiness({
          environment,
          hasNotification,
          hasServiceWorker,
          hasPushManager,
          permission,
          publicKey
        });
      }

      if (readiness !== "ready") {
        setWebPushStatus(readiness);
        return readiness;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription =
          existingSubscription ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          }));

        webPushEndpointRef.current = subscription.endpoint;
        await api.registerWebPushSubscription(token, subscription.toJSON());
        setWebPushStatus("ready");
        console.log("Registered Web Push subscription on server.");
        return "ready";
      } catch (error) {
        console.error("Failed to register Web Push subscription:", error);
        setWebPushStatus("unsupported");
        return "unsupported";
      }
    },
    [token]
  );

  const enableWebPushNotifications = useCallback(
    () => registerWebPush({ requestPermission: true }),
    [registerWebPush]
  );

  // Auto-register only when permission is already granted. iOS requires permission prompts to come from a user tap.
  useEffect(() => {
    if (!token || Platform.OS !== "web") {
      setWebPushStatus("unsupported");
      return;
    }

    registerWebPush({ requestPermission: false });
  }, [registerWebPush, token]);

  useEffect(() => {
    if (!token || Platform.OS !== "web") return;

    const authToken = token;
    return () => {
      const endpoint = webPushEndpointRef.current;
      if (endpoint) {
        api.unregisterWebPushSubscription(authToken, endpoint).catch((error) => {
          console.error("Failed to unregister Web Push subscription:", error);
        });
        webPushEndpointRef.current = undefined;
      }
    };
  }, [token]);

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
      const data = response.notification.request.content.data as { url?: string } | undefined;
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
      }
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

      showDeviceNotification(newNotification).catch((error) => {
        console.error("Failed to show device notification from socket event", error);
      });
    });

    return () => {
      socket.off("notification:created");
    };
  }, [showDeviceNotification, socket]);

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

  const deleteNotification = async (id: string) => {
    if (!token) return;
    try {
      await api.deleteNotification(token, id);
      setNotifications((current) => {
        const removed = current.find((n) => n._id === id);
        if (removed && !removed.read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return current.filter((n) => n._id !== id);
      });
    } catch (err) {
      console.error(`❌ Failed to delete notification ${id}:`, err);
    }
  };

  const deleteAllNotifications = async () => {
    if (!token) return;
    try {
      await api.deleteAllNotifications(token);
      applyNotifications([]);
    } catch (err) {
      console.error("❌ Failed to delete all notifications:", err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        webPushStatus,
        enableWebPushNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications
      }}
    >
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
