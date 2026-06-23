export type SettingsLogoutButton = {
  text: string;
  style?: "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

type RunSettingsLogoutOptions = {
  platformOS: string;
  signOut: () => void | Promise<void>;
  confirm?: (message: string) => boolean;
  showAlert: (title: string, message: string, buttons: SettingsLogoutButton[]) => void;
};

const LOGOUT_TITLE = "Đăng xuất";
const LOGOUT_MESSAGE = "Bạn có chắc muốn đăng xuất?";

export function createSettingsLogoutAlertButtons(signOut: () => void | Promise<void>): SettingsLogoutButton[] {
  return [
    { text: "Huỷ", style: "cancel" },
    { text: LOGOUT_TITLE, style: "destructive", onPress: () => void signOut() }
  ];
}

export async function runSettingsLogout({
  platformOS,
  signOut,
  confirm,
  showAlert
}: RunSettingsLogoutOptions) {
  if (platformOS === "web" && typeof confirm === "function") {
    if (confirm(LOGOUT_MESSAGE)) {
      await signOut();
    }
    return;
  }

  showAlert(LOGOUT_TITLE, LOGOUT_MESSAGE, createSettingsLogoutAlertButtons(signOut));
}
