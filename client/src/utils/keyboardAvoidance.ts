import type { KeyboardAvoidingViewProps, PlatformOSType } from "react-native";

export const IOS_MINIMUM_INPUT_FONT_SIZE = 16;

export function getKeyboardAvoidingBehavior(platform: PlatformOSType): KeyboardAvoidingViewProps["behavior"] {
  return platform === "ios" ? "position" : undefined;
}
