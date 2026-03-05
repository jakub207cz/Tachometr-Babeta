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
    const { PermissionsAndroid } = require("react-native");

    // Android 12+ requires explicit runtime permissions for BLE
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        granted["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED &&
        granted["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Android 11 and lower requires location for BLE scanning
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
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
