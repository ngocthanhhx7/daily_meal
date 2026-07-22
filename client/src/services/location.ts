import * as Location from "expo-location";

export type ForegroundLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

/**
 * Requests foreground permission only after a deliberate user action. This app
 * never watches location or asks for background access.
 */
export async function getCurrentForegroundLocation(): Promise<ForegroundLocation> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error("Vui lòng bật Dịch vụ định vị để tìm quán gần bạn.");
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Bạn chưa cấp quyền vị trí. Bạn vẫn có thể xem gợi ý món tại nhà.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy
  };
}
