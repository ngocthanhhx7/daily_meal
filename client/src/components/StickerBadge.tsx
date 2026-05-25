import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import type { Sticker } from "../types/api";
import { AppText } from "./AppText";

type StickerBadgeProps = {
  sticker?: Sticker;
};

export function StickerBadge({ sticker }: StickerBadgeProps) {
  if (!sticker) {
    return null;
  }

  return (
    <View style={[styles.badge, sticker.premiumOnly && styles.premium]}>
      <AppText variant="caption" style={styles.text}>
        {sticker.premiumOnly ? "VIP " : ""}
        {sticker.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.green
  },
  premium: {
    backgroundColor: colors.yellow
  },
  text: {
    color: colors.black
  }
});
