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
});

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectionState, setConnectionState] = useState<BLEConnectionState>("idle");
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // BLE manager is lazily initialized on native only
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
   * Request location permissions (required for BLE on Android 12+)
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
   * Check if BLE adapter is available and enabled
   */
  const checkBLEAdapter = useCallback(async (): Promise<boolean> => {
    const manager = getBLEManager();
    if (!manager) return false;

    try {
      // Check if Bluetooth is enabled
      const state = await manager.state();
      console.log("BLE adapter state:", state);
      return state === "PoweredOn";
    } catch (e) {
      console.warn("BLE adapter check error:", e);
      return false;
    }
  }, [getBLEManager]);

  /**
   * Request all necessary permissions and verify BLE adapter
   */
  const requestPermissionsAndVerifyAdapter = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setErrorMessage("Bluetooth is not available on web.");
      return false;
    }

    // Request location permission (required for BLE scan on Android 12+)
    const locationGranted = await requestLocationPermission();
    if (!locationGranted) {
      setErrorMessage("Location permission required for Bluetooth scanning.");
      return false;
    }

    // Request BLE runtime permissions for Android 12+
    const bleGranted = await requestBLEPermissions();
    if (!bleGranted) {
      setErrorMessage("Bluetooth permissions are required to scan for devices.");
      return false;
    }

    // Check if BLE adapter is available and enabled
    const adapterReady = await checkBLEAdapter();
    if (!adapterReady) {
      setErrorMessage("Bluetooth adapter is not available or disabled. Please enable Bluetooth.");
      return false;
    }

    return true;
  }, [requestLocationPermission, checkBLEAdapter]);

  const startScan = useCallback(async () => {
    if (Platform.OS === "web") {
      setErrorMessage("Bluetooth is not available on web.");
      return;
    }

    // Verify permissions and adapter state
    const ready = await requestPermissionsAndVerifyAdapter();
    if (!ready) {
      setConnectionState("error");
      return;
    }

    const manager = getBLEManager();
    if (!manager) {
      setErrorMessage("Bluetooth manager unavailable.");
      setConnectionState("error");
      return;
    }

    setDevices([]);
    setErrorMessage(null);
    setConnectionState("scanning");

    try {
      manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
        if (error) {
          console.warn("BLE scan error:", error);
          setErrorMessage(error.message ?? "Scan error");
          setConnectionState("error");
          return;
        }

        if (device) {
          setDevices((prev) => {
            const exists = prev.find((d) => d.id === device.id);
            if (exists) return prev;
            return [...prev, { id: device.id, name: device.name, rssi: device.rssi }];
          });
        }
      });

      // Auto-stop scan after 15 seconds
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        stopScan();
      }, 15000);
    } catch (e: any) {
      console.warn("BLE scan start error:", e);
      setErrorMessage(e.message ?? "Failed to start scan");
      setConnectionState("error");
    }
  }, [getBLEManager, requestPermissionsAndVerifyAdapter]);

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

  const connectToDevice = useCallback(
    async (device: BLEDevice) => {
      const manager = getBLEManager();
      if (!manager) return;

      stopScan();
      setConnectionState("connecting");
      setErrorMessage(null);

      try {
        const connected = await manager.connectToDevice(device.id);
        await connected.discoverAllServicesAndCharacteristics();
        setConnectedDevice(device);
        setConnectionState("connected");
      } catch (e: any) {
        console.warn("BLE connect error:", e);
        setErrorMessage(e.message ?? "Connection failed");
        setConnectionState("error");
      }
    },
    [getBLEManager, stopScan]
  );

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
