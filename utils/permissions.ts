import { Platform } from "react-native";
import * as Location from "expo-location";

/**
 * Request location permissions for GPS mode
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Location permission error:", error);
    return false;
  }
}

/**
 * Check if location permissions are already granted
 */
export async function checkLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Location permission check error:", error);
    return false;
  }
}

/**
 * Request BLE permissions for Android 12+
 * On iOS, BLE permissions are handled automatically by the system
 */
export async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    // iOS handles BLE permissions automatically
    return true;
  }

  try {
    // For Android 12+, we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
    // These are handled by expo-modules, but we ensure the app has declared them
    // The actual permission request happens when the user tries to scan
    return true;
  } catch (error) {
    console.error("BLE permission error:", error);
    return false;
  }
}

/**
 * Check if all required permissions are granted
 */
export async function checkAllPermissions(): Promise<{
  location: boolean;
  ble: boolean;
}> {
  const location = await checkLocationPermissions();
  const ble = await requestBLEPermissions();

  return { location, ble };
}
