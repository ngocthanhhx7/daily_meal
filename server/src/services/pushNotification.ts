import { User } from "../models/User.js";

type PushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, any>;
};

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
    const user = await User.findById(userId).select("pushTokens").lean();
    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      return;
    }

    const messages: PushMessage[] = [];
    for (const token of user.pushTokens) {
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

    if (messages.length === 0) {
      return;
    }

    console.log(`📡 Sending ${messages.length} push notification(s) to user: ${userId}`);

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
      return;
    }

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
  } catch (error) {
    console.error("❌ Error in sendPushNotification service:", error);
  }
}
