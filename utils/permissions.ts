import { Platform } from "react-native";
import * as Location from "expo-location";

/**
 * Vyžádejte si oprávnění k poloze pro režim GPS
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
 * Zkontrolujte, zda jsou již udělena oprávnění k poloze
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
 * Požádejte o oprávnění BLE pro Android 12+
 * V systému iOS jsou oprávnění BLE zpracovávána automaticky systémem
 */
export async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    // iOS zpracovává oprávnění BLE automaticky
    return true;
  }

  try {
    const { PermissionsAndroid } = require("react-native");

    // Android 12+ vyžaduje explicitní oprávnění k běhu pro BLE
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
      // Android 11 a nižší vyžaduje umístění pro skenování BLE
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
 * Zkontrolujte, zda jsou udělena všechna požadovaná oprávnění
 */
export async function checkAllPermissions(): Promise<{
  location: boolean;
  ble: boolean;
}> {
  const location = await checkLocationPermissions();
  const ble = await requestBLEPermissions();

  return { location, ble };
}
