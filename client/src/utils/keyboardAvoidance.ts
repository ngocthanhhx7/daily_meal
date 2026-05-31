import type { KeyboardAvoidingViewProps, PlatformOSType } from "react-native";

export function getKeyboardAvoidingBehavior(platform: PlatformOSType): KeyboardAvoidingViewProps["behavior"] {
  return platform === "ios" ? "position" : undefined;
}
