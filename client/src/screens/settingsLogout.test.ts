import { describe, expect, it, vi } from "vitest";
import { createSettingsLogoutAlertButtons, runSettingsLogout } from "./settingsLogout";

describe("settings logout helpers", () => {
  it("signs out immediately after web confirmation is accepted", async () => {
    const signOut = vi.fn();

    await runSettingsLogout({
      platformOS: "web",
      signOut,
      confirm: () => true,
      showAlert: vi.fn()
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when web confirmation is cancelled", async () => {
    const signOut = vi.fn();

    await runSettingsLogout({
      platformOS: "web",
      signOut,
      confirm: () => false,
      showAlert: vi.fn()
    });

    expect(signOut).not.toHaveBeenCalled();
  });

  it("builds a native destructive action that signs out", async () => {
    const signOut = vi.fn();
    const [, confirmButton] = createSettingsLogoutAlertButtons(signOut);

    await confirmButton.onPress?.();

    expect(confirmButton).toMatchObject({ text: "Đăng xuất", style: "destructive" });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
