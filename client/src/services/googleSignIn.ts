import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

declare const process: {
  env: Record<string, string | undefined>;
};

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

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error("Google login is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId
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
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google login is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  await loadGoogleScript();

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Google login timed out."));
    }, 60000);

    window.google?.accounts?.id?.initialize({
      client_id: clientId,
      callback: (response) => {
        window.clearTimeout(timeout);
        if (!response.credential) {
          reject(new Error("Google did not return an ID token."));
          return;
        }
        resolve(response.credential);
      }
    });

    window.google?.accounts?.id?.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        window.clearTimeout(timeout);
        reject(new Error("Google login was cancelled or unavailable."));
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
