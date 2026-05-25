import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { AppText } from "./AppText";

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  size?: "md" | "sm";
  style?: ViewStyle;
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  size = "md",
  style
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        size === "sm" && styles.sm,
        (pressed || disabled) && styles.dimmed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? colors.white : colors.ink}
        />
      ) : (
        <AppText
          variant="button"
          style={[
            styles.label,
            (variant === "primary" || variant === "danger") && styles.lightLabel
          ]}
          numberOfLines={1}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  sm: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  primary: {
    backgroundColor: colors.black
  },
  secondary: {
    backgroundColor: colors.green
  },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  danger: {
    backgroundColor: colors.red
  },
  dimmed: {
    opacity: 0.6
  },
  label: {
    fontFamily: fonts.semibold,
    // Ngăn label tràn
    flexShrink: 1
  },
  lightLabel: {
    color: colors.white
  }
});
