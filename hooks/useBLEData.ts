import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useBLE } from "@/context/BLEContext";
import { useLocation } from "@/context/LocationContext";
import { useAppMode } from "@/context/AppModeContext";

// ESP32-C6 BLE Service and Characteristic UUIDs
// These are common UUIDs — adjust to match your actual ESP32 firmware
const GPS_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const LAT_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const LON_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const SPEED_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

export function useBLEData() {
  const { mode } = useAppMode();
  const { connectionState, connectedDevice } = useBLE();
  const { updateFromBLE } = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const readCharacteristic = useCallback(async (manager: any, deviceId: string, serviceUUID: string, charUUID: string): Promise<string | null> => {
    try {
      const char = await manager.readCharacteristicForDevice(deviceId, serviceUUID, charUUID);
      if (char?.value) {
        // BLE characteristic value is base64 encoded
        const decoded = atob(char.value);
        return decoded.trim();
      }
    } catch (e) {
      // Characteristic may not be available yet
    }
    return null;
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (mode !== "ble") return;
    if (connectionState !== "connected" || !connectedDevice) return;

    let manager: any = null;
    try {
      const { BleManager } = require("react-native-ble-plx");
      manager = new BleManager();
    } catch {
      return;
    }

    // Poll BLE characteristics every 1 second
    intervalRef.current = setInterval(async () => {
      const deviceId = connectedDevice.id;

      const [latStr, lonStr, speedStr] = await Promise.all([
        readCharacteristic(manager, deviceId, GPS_SERVICE_UUID, LAT_CHAR_UUID),
        readCharacteristic(manager, deviceId, GPS_SERVICE_UUID, LON_CHAR_UUID),
        readCharacteristic(manager, deviceId, GPS_SERVICE_UUID, SPEED_CHAR_UUID),
      ]);

      if (latStr && lonStr) {
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        const speed = speedStr ? parseFloat(speedStr) : 0;

        if (!isNaN(lat) && !isNaN(lon)) {
          updateFromBLE(lat, lon, isNaN(speed) ? 0 : speed);
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, connectionState, connectedDevice, readCharacteristic, updateFromBLE]);
}
