import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useBLE } from "@/context/BLEContext";
import { useLocation } from "@/context/LocationContext";
import { useAppMode } from "@/context/AppModeContext";

// UUIDs služeb a charakteristik Bluetooth modulu ESP32-C6
// Tyto identifikátory musí přesně odpovídat kódu nahranému v mikrokontroléru ESP32 na Babettě!
const GPS_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"; // ID hlavní GPS služby
const LAT_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";    // ID charakteristiky pro zeměpisnou šířku (Latitude)
const LON_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";    // ID charakteristiky pro zeměpisnou délku (Longitude)
const SPEED_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";  // ID charakteristiky pro rychlost (Speed)

export function useBLEData() {
  const { mode } = useAppMode();
  const { connectionState, connectedDevice, readCharacteristic } = useBLE();
  const { updateFromBLE } = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (mode !== "ble") return;
    // Spustí se pouze tehdy, pokud je režim nastaven na "ble" a zařízení je úspěšně připojeno
    if (connectionState !== "connected" || !connectedDevice) return;

    // Pravidelný dotazovací cyklus (polling) každou 1 sekundu na hodnoty z ESP32 Babetty
    intervalRef.current = setInterval(async () => {
      // Paralelně přečteme všechny tři charakteristiky (zeměpisná šířka, délka, rychlost)
      const [latStr, lonStr, speedStr] = await Promise.all([
        readCharacteristic(GPS_SERVICE_UUID, LAT_CHAR_UUID),
        readCharacteristic(GPS_SERVICE_UUID, LON_CHAR_UUID),
        readCharacteristic(GPS_SERVICE_UUID, SPEED_CHAR_UUID),
      ]);

      if (latStr && lonStr) {
        // Převedeme řetězce (text) přijaté přes Bluetooth na desetinná čísla
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        const speed = speedStr ? parseFloat(speedStr) : 0;

        // Pokud jsou souřadnice validní čísla, předáme je do LocationContextu k uložení a vykreslení trasy
        if (!isNaN(lat) && !isNaN(lon)) {
          updateFromBLE(lat, lon, isNaN(speed) ? 0 : speed);
        }
      }
    }, 1000);

    // Vyčištění intervalu při odpojení nebo opuštění obrazovky
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, connectionState, connectedDevice, readCharacteristic, updateFromBLE]);
}
