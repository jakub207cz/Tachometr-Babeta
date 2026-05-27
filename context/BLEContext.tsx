import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { requestBLEPermissions } from "@/utils/permissions";

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

export type BLEConnectionState = "idle" | "scanning" | "connecting" | "connected" | "error";

interface BLEContextType {
  devices: BLEDevice[];
  connectionState: BLEConnectionState;
  connectedDevice: BLEDevice | null;
  errorMessage: string | null;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectToDevice: (device: BLEDevice) => Promise<void>;
  disconnect: () => void;
  readCharacteristic: (serviceUUID: string, charUUID: string) => Promise<string | null>;
}

const BLEContext = createContext<BLEContextType>({
  devices: [],
  connectionState: "idle",
  connectedDevice: null,
  errorMessage: null,
  startScan: async () => { },
  stopScan: () => { },
  connectToDevice: async () => { },
  disconnect: () => { },
  readCharacteristic: async () => null,
});

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectionState, setConnectionState] = useState<BLEConnectionState>("idle");
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Správce BLE je líně inicializován pouze na nativním
  const managerRef = useRef<any>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionsCheckedRef = useRef(false);

  const getBLEManager = useCallback(() => {
    if (Platform.OS === "web") return null;
    if (!managerRef.current) {
      try {
        const { BleManager } = require("react-native-ble-plx");
        managerRef.current = new BleManager();
      } catch (e) {
        console.warn("BLE not available:", e);
        return null;
      }
    }
    return managerRef.current;
  }, []);

  /**
   * Požádat o oprávnění k poloze (vyžadováno pro BLE na Androidu 12+)
   */
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    } catch (e) {
      console.warn("Location permission error:", e);
      return false;
    }
  }, []);

  /**
   * Zkontrolujte, zda je k dispozici a povolen adaptér BLE
   */
  const checkBLEAdapter = useCallback(async (): Promise<boolean> => {
    const manager = getBLEManager();
    if (!manager) return false;

    try {
      // Zkontrolujte, zda je povoleno Bluetooth
      const state = await manager.state();
      console.log("BLE adapter state:", state);
      return state === "PoweredOn";
    } catch (e) {
      console.warn("BLE adapter check error:", e);
      return false;
    }
  }, [getBLEManager]);

  /**
   * Vyžádejte si všechna potřebná oprávnění a ověřte adaptér BLE
   */
  const requestPermissionsAndVerifyAdapter = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setErrorMessage("Bluetooth není na webu k dispozici.");
      return false;
    }

    // Požádat o povolení k poloze (vyžadováno pro skenování BLE v systému Android 12+)
    const locationGranted = await requestLocationPermission();
    if (!locationGranted) {
      setErrorMessage("Pro vyhledávání Bluetooth je vyžadováno povolení k polohovým službám.");
      return false;
    }

    // Požádejte o oprávnění BLE runtime pro Android 12+
    const bleGranted = await requestBLEPermissions();
    if (!bleGranted) {
      setErrorMessage("Pro vyhledávání zařízení jsou vyžadována oprávnění k Bluetooth.");
      return false;
    }

    // Zkontrolujte, zda je k dispozici a povolen adaptér BLE
    const adapterReady = await checkBLEAdapter();
    if (!adapterReady) {
      setErrorMessage("Bluetooth adaptér není k dispozici nebo je vypnutý. Zapněte prosím Bluetooth.");
      return false;
    }

    return true;
  }, [requestLocationPermission, checkBLEAdapter]);

  // Spuštění vyhledávání Bluetooth zařízení
  const startScan = useCallback(async () => {
    if (Platform.OS === "web") {
      setErrorMessage("Bluetooth není na webu k dispozici.");
      return;
    }

    // Ověření potřebných oprávnění a stavu Bluetooth adaptéru v telefonu
    const ready = await requestPermissionsAndVerifyAdapter();
    if (!ready) {
      setConnectionState("error");
      return;
    }

    const manager = getBLEManager();
    if (!manager) {
      setErrorMessage("Bluetooth správce není k dispozici.");
      setConnectionState("error");
      return;
    }

    setDevices([]);
    setErrorMessage(null);
    setConnectionState("scanning");

    try {
      // Zahájení samotného skenování okolí
      manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
        if (error) {
          console.warn("BLE scan error:", error);
          setErrorMessage(error.message ?? "Chyba při vyhledávání");
          setConnectionState("error");
          return;
        }

        if (device) {
          const name = device.name;
          // FILTRACE ZAŘÍZENÍ: Zobrazujeme pouze zařízení, které mají v názvu "babeta" nebo "babetta"
          // Tím zamezíme zobrazení televizí, hodinek a jiného Bluetooth šumu v okolí.
          const isBabetta = name && (name.toLowerCase().includes("babeta") || name.toLowerCase().includes("babetta"));
          if (isBabetta) {
            setDevices((prev) => {
              const exists = prev.find((d) => d.id === device.id);
              if (exists) return prev;
              // Uložíme ID, název a sílu signálu RSSI
              return [...prev, { id: device.id, name: device.name, rssi: device.rssi }];
            });
          }
        }
      });

      // Automatické zastavení vyhledávání po 15 sekundách (šetří baterii zařízení)
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        stopScan();
      }, 15000);
    } catch (e: any) {
      console.warn("BLE scan start error:", e);
      setErrorMessage(e.message ?? "Nepodařilo se spustit vyhledávání");
      setConnectionState("error");
    }
  }, [getBLEManager, requestPermissionsAndVerifyAdapter]);

  // Zastavení vyhledávání Bluetooth zařízení
  const stopScan = useCallback(() => {
    const manager = getBLEManager();
    if (manager) {
      try {
        manager.stopDeviceScan();
      } catch (e) {
        console.warn("BLE stop scan error:", e);
      }
    }
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setConnectionState((prev) => (prev === "scanning" ? "idle" : prev));
  }, [getBLEManager]);

  // Připojení k vybranému Bluetooth zařízení
  const connectToDevice = useCallback(
    async (device: BLEDevice) => {
      const manager = getBLEManager();
      if (!manager) return;

      stopScan(); // Před připojením zastavíme vyhledávání
      setConnectionState("connecting");
      setErrorMessage(null);

      try {
        // Navázání spojení se zařízením
        const connected = await manager.connectToDevice(device.id);
        // Vyhledání všech dostupných služeb a charakteristik na ESP32 (klíčové pro čtení dat)
        await connected.discoverAllServicesAndCharacteristics();
        setConnectedDevice(device);
        setConnectionState("connected");
      } catch (e: any) {
        console.warn("BLE connect error:", e);
        setErrorMessage(e.message ?? "Připojení selhalo");
        setConnectionState("error");
      }
    },
    [getBLEManager, stopScan]
  );

  // Odpojení od aktuálně připojeného Bluetooth zařízení
  const disconnect = useCallback(() => {
    const manager = getBLEManager();
    if (manager && connectedDevice) {
      try {
        manager.cancelDeviceConnection(connectedDevice.id).catch(() => { });
      } catch (e) {
        console.warn("BLE disconnect error:", e);
      }
    }
    setConnectedDevice(null);
    setConnectionState("idle");
    setErrorMessage(null);
  }, [getBLEManager, connectedDevice]);

  // Pomocná metoda pro přečtení hodnoty konkrétní Bluetooth charakteristiky
  const readCharacteristic = useCallback(
    async (serviceUUID: string, charUUID: string): Promise<string | null> => {
      const manager = getBLEManager();
      if (!manager || !connectedDevice) return null;

      try {
        // Přečteme data ze zařízení (vrací Base64 kódovaný řetězec)
        const char = await manager.readCharacteristicForDevice(
          connectedDevice.id,
          serviceUUID,
          charUUID
        );
        if (char?.value) {
          // Dekódujeme Base64 na běžný text (ASCII) a ořízneme mezery
          return atob(char.value).trim();
        }
      } catch (e) {
        // Charakteristika nemusí být ještě připravená, nebo došlo k odpojení
      }
      return null;
    },
    [getBLEManager, connectedDevice]
  );

  return (
    <BLEContext.Provider
      value={{
        devices,
        connectionState,
        connectedDevice,
        errorMessage,
        startScan,
        stopScan,
        connectToDevice,
        disconnect,
        readCharacteristic,
      }}
    >
      {children}
    </BLEContext.Provider>
  );
}

export function useBLE(): BLEContextType {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error("useBLE must be used within BLEProvider");
  }
  return context;
}
