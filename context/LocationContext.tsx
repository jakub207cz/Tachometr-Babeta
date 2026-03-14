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
  const lastPosRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

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

    const processLocation = (
        lat: number, 
        lon: number, 
        rawSpeed: number, 
        accuracy?: number | null, 
        heading?: number | null
    ) => {
        const now = Date.now();
        let finalSpeed = Math.max(0, rawSpeed * 3.6); // km/h
        
        // Advanced GPS Drift Filter
        // If accuracy is terrible, don't trust the speed
        if (accuracy && accuracy > 30) {
            finalSpeed = 0;
        } else if (lastPosRef.current) {
            import("@turf/helpers").then(turfHelpers => {
                import("@turf/distance").then(turfDistance => {
                    const p1 = turfHelpers.point([lastPosRef.current!.lon, lastPosRef.current!.lat]);
                    const p2 = turfHelpers.point([lon, lat]);
                    // Distance in meters
                    const distMeters = turfDistance.default(p1, p2, { units: "kilometers" }) * 1000;
                    const timeDiffSec = (now - lastPosRef.current!.time) / 1000;
                    
                    if (timeDiffSec > 0) {
                        // Calculate real physical speed from distance and time
                        const calculatedSpeedKmh = (distMeters / timeDiffSec) * 3.6;
                        
                        // If the OS reports we are moving e.g. 4 km/h, but physically 
                        // the coordinates only moved 0.5 meters in 2 seconds, it's just GPS drift.
                        // We force speed to 0. But if we physically moved 2 meters (e.g. 7 km/h calculated 
                        // or walking), we allow the low speed.
                        if (calculatedSpeedKmh < 1.0 || (finalSpeed > 0 && distMeters < 1.0)) {
                           finalSpeed = 0;
                        }
                    }

                    if (active) {
                        setLocation({
                            latitude: lat,
                            longitude: lon,
                            speed: finalSpeed,
                            accuracy: accuracy != null ? accuracy : undefined,
                            heading: heading != null ? heading : undefined,
                        });
                        if (finalSpeed > 0) {
                            setMaxSpeed((prev) => Math.max(prev, finalSpeed));
                        }
                        lastPosRef.current = { lat, lon, time: now };
                    }
                });
            });
            return; // State update is handled async inside turf promise
        }

        // First location update
        if (active) {
            setLocation({
                latitude: lat,
                longitude: lon,
                speed: finalSpeed,
                accuracy: accuracy != null ? accuracy : undefined,
                heading: heading != null ? heading : undefined,
            });
            if (finalSpeed > 0) {
                setMaxSpeed((prev) => Math.max(prev, finalSpeed));
            }
            lastPosRef.current = { lat, lon, time: now };
        }
    };

    const startWatching = async () => {
      const granted = await requestPermission();
      if (!granted || !active) return;

      if (Platform.OS === "web") {
        // Web fallback using browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (pos) => {
              if (!active) return;
              processLocation(
                  pos.coords.latitude, 
                  pos.coords.longitude, 
                  pos.coords.speed ?? 0, 
                  pos.coords.accuracy, 
                  pos.coords.heading
              );
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
          processLocation(
              loc.coords.latitude, 
              loc.coords.longitude, 
              loc.coords.speed ?? 0, 
              loc.coords.accuracy, 
              loc.coords.heading
          );
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
