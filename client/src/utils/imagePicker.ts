import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

type ImageSource = "camera" | "library";

const imageOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.85
};

async function ensureCameraPermission() {
  if (Platform.OS === "web") {
    return true;
  }
  const currentPermission = await ImagePicker.getCameraPermissionsAsync();

  if (currentPermission.granted) {
    return true;
  }

  const nextPermission = currentPermission.canAskAgain
    ? await ImagePicker.requestCameraPermissionsAsync()
    : currentPermission;

  if (nextPermission.granted) {
    return true;
  }

  const buttons = nextPermission.canAskAgain
    ? [{ text: "OK" }]
    : [
        { text: "Hủy", style: "cancel" as const },
        { text: "Mở cài đặt", onPress: () => Linking.openSettings() }
      ];

  Alert.alert(
    "Cần quyền camera",
    "Hãy cho phép Daily Meal dùng camera để chụp ảnh món ăn.",
    buttons
  );

  return false;
}

async function ensureLibraryPermission() {
  if (Platform.OS === "web") {
    return true;
  }
  const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (currentPermission.granted) {
    return true;
  }

  const nextPermission = currentPermission.canAskAgain
    ? await ImagePicker.requestMediaLibraryPermissionsAsync()
    : currentPermission;

  if (nextPermission.granted) {
    return true;
  }

  const buttons = nextPermission.canAskAgain
    ? [{ text: "OK" }]
    : [
        { text: "Hủy", style: "cancel" as const },
        { text: "Mở cài đặt", onPress: () => Linking.openSettings() }
      ];

  Alert.alert(
    "Cần quyền thư viện ảnh",
    "Hãy cho phép Daily Meal truy cập ảnh để chọn ảnh từ album.",
    buttons
  );

  return false;
}

function showPickerError(source: ImageSource, error: unknown) {
  const title = source === "camera" ? "Không mở được camera" : "Không mở được thư viện ảnh";
  const fallback =
    source === "camera"
      ? "Kiểm tra quyền camera, thiết bị có camera và thử lại."
      : "Kiểm tra quyền ảnh và thử lại.";
  const detail = error instanceof Error ? error.message : fallback;

  Alert.alert(title, detail);
}

export async function pickSingleImage(source: ImageSource) {
  try {
    const hasPermission =
      source === "camera" ? await ensureCameraPermission() : await ensureLibraryPermission();

    if (!hasPermission) {
      return undefined;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(imageOptions)
        : await ImagePicker.launchImageLibraryAsync(imageOptions);

    if (result.canceled) {
      return undefined;
    }

    return result.assets[0]?.uri;
  } catch (error) {
    showPickerError(source, error);
    return undefined;
  }
}

export async function pickMultipleImages(limit: number) {
  try {
    const hasPermission = await ensureLibraryPermission();

    if (!hasPermission) {
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      ...imageOptions,
      allowsMultipleSelection: true,
      selectionLimit: limit
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map((asset) => asset.uri).filter(Boolean);
  } catch (error) {
    showPickerError("library", error);
    return [];
  }
}

export async function getPendingPickedImageUris() {
  const pendingResult = await ImagePicker.getPendingResultAsync();

  if (!pendingResult || "code" in pendingResult || pendingResult.canceled) {
    return [];
  }

  return pendingResult.assets.map((asset) => asset.uri).filter(Boolean);
}

export async function getPendingPickedImageUri() {
  const [first] = await getPendingPickedImageUris();
  return first;
}
