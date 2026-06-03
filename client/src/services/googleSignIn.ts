import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

// Expo Metro bundler injector: các biến EXPO_PUBLIC_ phải được dùng TRỰC TIẾP
// (không thể dùng qua biến trung gian hay spread)
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleCredentialResponse = {
  credential?: string;
};

type GooglePromptNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (callback?: (notification: GooglePromptNotification) => void) => void;
        };
      };
    };
  }
}

let configured = false;

function configureNativeGoogle() {
  if (configured) {
    return;
  }

  if (!WEB_CLIENT_ID) {
    throw new Error(
      "Google chưa được cấu hình. Vui lòng kiểm tra Google Client ID."
    );
  }

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID
  });
  configured = true;
}

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Google login is not available in this environment."));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-daily-meal-google]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google login.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.dailyMealGoogle = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google login."));
    document.head.appendChild(script);
  });
}

async function getWebGoogleIdToken() {
  if (!WEB_CLIENT_ID) {
    throw new Error(
      "Google chưa được cấu hình. Vui lòng kiểm tra Google Client ID."
    );
  }

  await loadGoogleScript();

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      const button = document.getElementById("daily-meal-google-signin-button");
      if (button) button.remove();
      reject(new Error("Google login timed out."));
    }, 60000);

    window.google?.accounts?.id?.initialize({
      client_id: WEB_CLIENT_ID,
      callback: (response) => {
        window.clearTimeout(timeout);
        const button = document.getElementById("daily-meal-google-signin-button");
        if (button) button.remove();

        if (!response.credential) {
          reject(new Error("Google did not return an ID token."));
          return;
        }
        resolve(response.credential);
      }
    });

    let button = document.getElementById("daily-meal-google-signin-button") as HTMLDivElement | null;
    if (!button) {
      button = document.createElement("div");
      button.id = "daily-meal-google-signin-button";
      button.style.position = "fixed";
      button.style.left = "50%";
      button.style.top = "50%";
      button.style.transform = "translate(-50%, -50%)";
      button.style.zIndex = "2147483647";
      button.style.background = "#fff";
      button.style.padding = "16px";
      button.style.borderRadius = "12px";
      button.style.boxShadow = "0 12px 32px rgba(0,0,0,0.24)";
      document.body.appendChild(button);
    }
    button.innerHTML = "";

    window.google?.accounts?.id?.renderButton(button, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill"
    });

    window.google?.accounts?.id?.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        // The rendered button remains visible as a fallback because One Tap is often blocked.
      }
    });
  });
}

export async function getGoogleIdToken() {
  if (Platform.OS === "web") {
    return getWebGoogleIdToken();
  }

  try {
    configureNativeGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    if (result.type === "cancelled") {
      throw new Error("Google login was cancelled.");
    }

    const idToken = result.data.idToken;
    if (!idToken) {
      throw new Error("Google did not return an ID token.");
    }

    return idToken;
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google login was cancelled.");
    }
    throw error;
  }
}

// Debug helper — gọi trong dev để xác nhận biến env đã được inject
export function debugGoogleConfig() {
  console.log("[Google Sign-In] WEB_CLIENT_ID:", WEB_CLIENT_ID ? `...${WEB_CLIENT_ID.slice(-20)}` : "MISSING");
  console.log("[Google Sign-In] IOS_CLIENT_ID:", IOS_CLIENT_ID ? `...${IOS_CLIENT_ID.slice(-20)}` : "MISSING");
}
