import type { PwaEnvironment } from "./platform";

export type WebPushReadinessInput = {
  environment: PwaEnvironment;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: NotificationPermission;
  publicKey?: string;
};

export type WebPushReadiness =
  | "unsupported"
  | "install-required"
  | "permission-denied"
  | "missing-public-key"
  | "needs-permission"
  | "ready";

export function getWebPushReadiness(input: WebPushReadinessInput): WebPushReadiness {
  if (
    !input.environment.isWeb ||
    !input.hasNotification ||
    !input.hasServiceWorker ||
    !input.hasPushManager
  ) {
    return "unsupported";
  }

  if (input.environment.isIos && !input.environment.isStandalone) {
    return "install-required";
  }

  if (input.permission === "denied") {
    return "permission-denied";
  }

  if (!input.publicKey) {
    return "missing-public-key";
  }

  if (input.permission === "granted") {
    return "ready";
  }

  return "needs-permission";
}

export function shouldAutoRequestWebPushPermission(input: {
  readiness: WebPushReadiness;
  hasAutoRequested: boolean;
}) {
  return input.readiness === "needs-permission" && !input.hasAutoRequested;
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
