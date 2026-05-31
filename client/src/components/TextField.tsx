import React from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { IOS_MINIMUM_INPUT_FONT_SIZE } from "../utils/keyboardAvoidance";
import { AppText } from "./AppText";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, style, error, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && styles.inputMultiline,
          error && styles.inputError,
          style
        ]}
      />
      {error ? (
        <AppText variant="caption" style={styles.errorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: IOS_MINIMUM_INPUT_FONT_SIZE,
    color: colors.ink
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  inputError: {
    borderColor: colors.red
  },
  errorText: {
    color: colors.red
  }
});
