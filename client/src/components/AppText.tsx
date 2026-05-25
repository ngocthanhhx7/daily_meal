import React from "react";
import { Text, type TextProps, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

type Variant = "title" | "subtitle" | "body" | "caption" | "button" | "label";

type AppTextProps = TextProps & {
  variant?: Variant;
  muted?: boolean;
};

export function AppText({ style, variant = "body", muted, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[styles.base, styles[variant], muted && styles.muted, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
    fontFamily: fonts.regular,
    letterSpacing: 0,
    // Ngăn text tràn layout trên mọi màn
    flexShrink: 1
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    flexShrink: 0
  },
  subtitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24
  },
  body: {
    fontSize: 15,
    lineHeight: 22
  },
  caption: {
    fontSize: 12,
    lineHeight: 17
  },
  button: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  muted: {
    color: colors.muted
  }
});
