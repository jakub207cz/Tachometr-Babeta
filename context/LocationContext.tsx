import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { useAppMode } from "./AppModeContext";

export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  accuracy?: number;
  heading?: number;
}

interface LocationContextType {
  location: LocationData | null;
  maxSpeed: number; // Global maximum speed (km/h) across the entire session
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  updateFromBLE: (lat: number, lon: number, speed: number) => void;
}

const LocationContext = createContext<LocationContextType>({
  location: null,
  maxSpeed: 0,
  permissionGranted: false,
  requestPermission: async () => false,
  updateFromBLE: () => {},
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [maxSpeed, setMaxSpeed] = useState<number>(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { mode } = useAppMode();
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setPermissionGranted(true);
      return true;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    setPermissionGranted(granted);
    return granted;
  };

  const updateFromBLE = (lat: number, lon: number, speed: number) => {
    setLocation({ latitude: lat, longitude: lon, speed });
    setMaxSpeed((prev) => Math.max(prev, speed));
  };

  useEffect(() => {
    if (mode !== "standalone") {
      // Stop GPS watcher when in BLE mode or no mode
      if (watcherRef.current) {
        watcherRef.current.remove();
        watcherRef.current = null;
      }
      return;
    }

    let active = true;

    const startWatching = async () => {
      const granted = await requestPermission();
      if (!granted || !active) return;

      if (Platform.OS === "web") {
        // Web fallback using browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (pos) => {
              if (!active) return;
              const speedMs = pos.coords.speed ?? 0;
              setLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: Math.max(0, speedMs * 3.6), // m/s → km/h
                accuracy: pos.coords.accuracy,
                heading: pos.coords.heading != null ? pos.coords.heading : undefined,
              });
            },
            (err) => console.warn("Web geolocation error:", err),
            { enableHighAccuracy: true, maximumAge: 1000 }
          );
        }
        return;
      }

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          if (!active) return;
          const speedMs = loc.coords.speed ?? 0;
          const newSpeed = Math.max(0, speedMs * 3.6); // m/s → km/h
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: newSpeed,
            accuracy: loc.coords.accuracy != null ? loc.coords.accuracy : undefined,
            heading: loc.coords.heading != null ? loc.coords.heading : undefined,
          });
          setMaxSpeed((prev) => Math.max(prev, newSpeed));
        }
      );
    };

    startWatching();

    return () => {
      active = false;
      if (watcherRef.current) {
        watcherRef.current.remove();
        watcherRef.current = null;
      }
    };
  }, [mode]);

  return (
    <LocationContext.Provider value={{ location, maxSpeed, permissionGranted, requestPermission, updateFromBLE }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
