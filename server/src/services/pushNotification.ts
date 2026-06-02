import { User } from "../models/User.js";
import webPush, { type PushSubscription } from "web-push";

type PushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, any>;
};

let webPushConfigured = false;

function configureWebPush() {
  if (webPushConfigured) return true;

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:support@ngocthanhhx7.site";

  if (!publicKey || !privateKey) {
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  webPushConfigured = true;
  return true;
}

/**
 * Sends a push notification to all Expo push tokens registered to a user.
 * Performs automatic cleanup if a token is marked as unregistered by Expo.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const user = await User.findById(userId).select("pushTokens webPushSubscriptions").lean();
    if (!user) {
      return;
    }

    const messages: PushMessage[] = [];
    for (const token of user.pushTokens ?? []) {
      // Validate that it looks like an Expo push token
      if (typeof token === "string" && token.startsWith("ExponentPushToken[")) {
        messages.push({
          to: token,
          sound: "default",
          title,
          body,
          data
        });
      }
    }

    if (messages.length > 0) {
      console.log(`📡 Sending ${messages.length} Expo push notification(s) to user: ${userId}`);

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(messages)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to send push notifications via Expo: ${response.status} - ${errorText}`);
      } else {
        const result = await response.json();
        console.log(`✅ Push notifications sent successfully via Expo:`, JSON.stringify(result));

        // Handle token cleanup if any device has unregistered
        if (result && Array.isArray(result.data)) {
          const tokensToRemove: string[] = [];
          result.data.forEach((ticket: any, index: number) => {
            if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
              const msg = messages[index];
              if (msg) {
                tokensToRemove.push(msg.to);
              }
            }
          });

          if (tokensToRemove.length > 0) {
            console.log(`🧹 Removing ${tokensToRemove.length} inactive push token(s) for user: ${userId}`);
            await User.findByIdAndUpdate(userId, {
              $pull: { pushTokens: { $in: tokensToRemove } }
            });
          }
        }
      }
    }

    const webSubscriptions = user.webPushSubscriptions ?? [];
    if (webSubscriptions.length > 0) {
      if (!configureWebPush()) {
        console.warn("⚠️ Web Push VAPID keys are missing. Set WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY.");
        return;
      }

      const payload = JSON.stringify({
        title,
        body,
        data,
        icon: "/icons/daily-meal-icon-v2.png",
        badge: "/favicon.png"
      });

      const staleEndpoints: string[] = [];
      await Promise.all(
        webSubscriptions.map(async (subscription) => {
          if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            return;
          }

          const pushSubscription: PushSubscription = {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime ?? null,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          };

          try {
            await webPush.sendNotification(pushSubscription, payload);
          } catch (error: any) {
            const statusCode = error?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              staleEndpoints.push(pushSubscription.endpoint);
              return;
            }

            console.error("❌ Failed to send Web Push notification:", error);
          }
        })
      );

      if (staleEndpoints.length > 0) {
        console.log(`🧹 Removing ${staleEndpoints.length} inactive Web Push subscription(s) for user: ${userId}`);
        await User.findByIdAndUpdate(userId, {
          $pull: { webPushSubscriptions: { endpoint: { $in: staleEndpoints } } }
        });
      }
    }
  } catch (error) {
    console.error("❌ Error in sendPushNotification service:", error);
  }
}
