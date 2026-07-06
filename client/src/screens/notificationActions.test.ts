import { describe, expect, it, vi } from "vitest";
import {
  createDeleteAllNotificationButtons,
  runDeleteAllNotificationsConfirmation
} from "./notificationActions";

describe("notificationActions", () => {
  it("does not open delete-all confirmation when there are no notifications", () => {
    const showAlert = vi.fn();

    runDeleteAllNotificationsConfirmation({
      notificationCount: 0,
      deleteAllNotifications: vi.fn(),
      showAlert
    });

    expect(showAlert).not.toHaveBeenCalled();
  });

  it("opens delete-all confirmation with cancel and destructive actions", () => {
    const showAlert = vi.fn();

    runDeleteAllNotificationsConfirmation({
      notificationCount: 2,
      deleteAllNotifications: vi.fn(),
      showAlert
    });

    expect(showAlert).toHaveBeenCalledWith(
      "Xóa tất cả thông báo?",
      "Thao tác này sẽ dọn sạch toàn bộ thông báo của bạn.",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa tất cả", style: "destructive", onPress: expect.any(Function) }
      ]
    );
  });

  it("runs delete-all only from the destructive confirmation action", () => {
    const deleteAllNotifications = vi.fn();
    const buttons = createDeleteAllNotificationButtons(deleteAllNotifications);

    buttons[0].onPress?.();
    expect(deleteAllNotifications).not.toHaveBeenCalled();

    buttons[1].onPress?.();
    expect(deleteAllNotifications).toHaveBeenCalledTimes(1);
  });
});
