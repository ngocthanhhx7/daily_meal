import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { Ionicons } from "@expo/vector-icons";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function EmptyState({ title, message, actionLabel, onAction, icon = "leaf-outline" }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.muted} />
      </View>
      <AppText variant="subtitle" style={styles.title}>
        {title}
      </AppText>
      <AppText muted style={styles.message}>
        {message}
      </AppText>
      {actionLabel ? (
        <AppButton label={actionLabel} onPress={onAction} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 24
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  title: {
    textAlign: "center"
  },
  message: {
    textAlign: "center",
    maxWidth: 260
  }
});
