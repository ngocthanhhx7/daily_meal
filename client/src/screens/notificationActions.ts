export type NotificationAlertButton = {
  text: string;
  style?: "cancel" | "destructive";
  onPress?: () => void;
};

type DeleteAllConfirmationParams = {
  notificationCount: number;
  deleteAllNotifications: () => void;
  showAlert: (title: string, message: string, buttons: NotificationAlertButton[]) => void;
};

export function createDeleteAllNotificationButtons(
  deleteAllNotifications: () => void
): NotificationAlertButton[] {
  return [
    { text: "Hủy", style: "cancel" },
    { text: "Xóa tất cả", style: "destructive", onPress: deleteAllNotifications }
  ];
}

export function runDeleteAllNotificationsConfirmation({
  notificationCount,
  deleteAllNotifications,
  showAlert
}: DeleteAllConfirmationParams) {
  if (notificationCount === 0) return;

  showAlert(
    "Xóa tất cả thông báo?",
    "Thao tác này sẽ dọn sạch toàn bộ thông báo của bạn.",
    createDeleteAllNotificationButtons(deleteAllNotifications)
  );
}
