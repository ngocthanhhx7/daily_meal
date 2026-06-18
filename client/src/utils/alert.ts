import { Alert as RNAlert, Platform } from "react-native";

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: Array<{
      text?: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
    options?: { cancelable?: boolean }
  ) => {
    if (Platform.OS === "web") {
      const displayMsg = message ? `${title}\n\n${message}` : title;
      if (buttons && buttons.length > 0) {
        // If there is a cancel button or multiple options, use confirm
        const hasCancel = buttons.some(
          (b) =>
            b.style === "cancel" ||
            b.text?.toLowerCase() === "hủy" ||
            b.text?.toLowerCase() === "cancel"
        );
        if (hasCancel || buttons.length > 1) {
          const confirmed = window.confirm(displayMsg);
          if (confirmed) {
            const confirmBtn =
              buttons.find(
                (b) =>
                  b.style !== "cancel" &&
                  b.text?.toLowerCase() !== "hủy" &&
                  b.text?.toLowerCase() !== "cancel"
              ) || buttons[0];
            confirmBtn.onPress?.();
          } else {
            const cancelBtn = buttons.find(
              (b) =>
                b.style === "cancel" ||
                b.text?.toLowerCase() === "hủy" ||
                b.text?.toLowerCase() === "cancel"
            );
            cancelBtn?.onPress?.();
          }
        } else {
          window.alert(displayMsg);
          buttons[0].onPress?.();
        }
      } else {
        window.alert(displayMsg);
      }
    } else {
      RNAlert.alert(title, message, buttons, options);
    }
  }
};
