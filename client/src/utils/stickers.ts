import type { ImageSourcePropType } from "react-native";
import type { Sticker } from "../types/api";

const stickerAssets: Record<string, ImageSourcePropType> = {
  "custom-smile": require("../../assets/stickers/custom-smile.png"),
  "openmoji-yum": require("../../assets/stickers/openmoji-yum.png"),
  "openmoji-cooking": require("../../assets/stickers/openmoji-cooking.png"),
  "openmoji-noodles": require("../../assets/stickers/openmoji-noodles.png")
};

export function stickerImageSource(sticker?: Sticker): ImageSourcePropType | undefined {
  if (!sticker) {
    return undefined;
  }

  if (sticker._id.startsWith("custom-user-") || sticker.key.startsWith("custom-user-")) {
    return { uri: sticker.assetPath };
  }

  if (sticker.assetPath && (sticker.assetPath.startsWith("http") || sticker.assetPath.startsWith("file:") || sticker.assetPath.startsWith("content:"))) {
    return { uri: sticker.assetPath };
  }

  return stickerAssets[sticker.key];
}
