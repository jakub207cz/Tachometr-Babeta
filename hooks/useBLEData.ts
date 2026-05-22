import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useBLE } from "@/context/BLEContext";
import { useLocation } from "@/context/LocationContext";
import { useAppMode } from "@/context/AppModeContext";

// ESP32-C6 BLE Service and Characteristic UUIDs
const GPS_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const LAT_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const LON_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const SPEED_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

export function useBLEData() {
  const { mode } = useAppMode();
  const { connectionState, connectedDevice, readCharacteristic } = useBLE();
  const { updateFromBLE } = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (mode !== "ble") return;
    if (connectionState !== "connected" || !connectedDevice) return;

    // Poll BLE characteristics every 1 second using shared BLEContext reader
    intervalRef.current = setInterval(async () => {
      const [latStr, lonStr, speedStr] = await Promise.all([
        readCharacteristic(GPS_SERVICE_UUID, LAT_CHAR_UUID),
        readCharacteristic(GPS_SERVICE_UUID, LON_CHAR_UUID),
        readCharacteristic(GPS_SERVICE_UUID, SPEED_CHAR_UUID),
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
