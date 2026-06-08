import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AuthSession from "expo-auth-session";

// Expo Metro bundler injector: các biến EXPO_PUBLIC_ phải được dùng TRỰC TIẾP
// (không thể dùng qua biến trung gian hay spread)
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

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

async function getWebGoogleIdToken() {
  if (!WEB_CLIENT_ID) {
    throw new Error(
      "Google chưa được cấu hình. Vui lòng kiểm tra Google Client ID."
    );
  }

  const redirectUri = AuthSession.makeRedirectUri();
  const nonce = Math.random().toString(36).substring(2, 15);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(WEB_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=id_token` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&nonce=${encodeURIComponent(nonce)}`;

  const result = await AuthSession.startAsync({
    authUrl,
    returnUrl: redirectUri
  });

  if (result.type === "success") {
    const idToken = result.params.id_token || result.params.credential;
    if (idToken) {
      return idToken;
    }
  }

  if (result.type === "cancel") {
    throw new Error("Đăng nhập bằng Google đã bị hủy.");
  }

  throw new Error("Không thể đăng nhập bằng Google.");
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
