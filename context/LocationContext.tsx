import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as turf from "@turf/helpers";
import distance from "@turf/distance";
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

  // Načtení celkové maximální rychlosti z trvalého úložiště při startu aplikace
  useEffect(() => {
    const loadMaxSpeed = async () => {
      try {
        const stored = await AsyncStorage.getItem("babetta_max_speed");
        if (stored !== null) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed)) {
            setMaxSpeed(parsed);
          }
        }
      } catch (e) {
        console.warn("Chyba při načítání maximální rychlosti z AsyncStorage:", e);
      }
    };
    loadMaxSpeed();
  }, []);

  // Pomocná metoda pro bezpečné uložení nové maximální rychlosti do trvalého úložiště
  const updateMaxSpeed = useCallback((speed: number) => {
    if (speed <= 0) return;
    setMaxSpeed((prev) => {
      const newMax = Math.max(prev, speed);
      if (newMax > prev) {
        AsyncStorage.setItem("babetta_max_speed", newMax.toString()).catch((err) => {
          console.warn("Chyba při ukládání maximální rychlosti do AsyncStorage:", err);
        });
      }
      return newMax;
    });
  }, []);

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

  // Zpracování nových souřadnic (z GPS telefonu nebo Bluetooth modulu Babetty)
  const processLocation = useCallback((
      lat: number, 
      lon: number, 
      speedKmh: number, 
      accuracy?: number | null, 
      heading?: number | null
  ) => {
      const now = Date.now();
      let finalSpeed = Math.max(0, speedKmh);
      
      // Pokročilá filtrace chyb GPS (GPS Drift Filter)
      // Pokud je nepřesnost signálu příliš vysoká (více než 30 metrů), rychlosti nevěříme a nastavíme 0.
      if (accuracy && accuracy > 30) {
          finalSpeed = 0;
      } else if (lastPosRef.current) {
          // Vytvoříme body pro knihovnu Turf k výpočtu vzdálenosti
          const p1 = turf.point([lastPosRef.current.lon, lastPosRef.current.lat]);
          const p2 = turf.point([lon, lat]);
          
          // Výpočet fyzické vzdálenosti mezi body v metrech
          const distMeters = distance(p1, p2, { units: "kilometers" }) * 1000;
          
          // Časový rozdíl od posledního měření v sekundách
          const timeDiffSec = (now - lastPosRef.current.time) / 1000;
          
          if (timeDiffSec > 0) {
              // Výpočet reálné rychlosti: dráha (m) / čas (s) převedeno na km/h (* 3.6)
              const calculatedSpeedKmh = (distMeters / timeDiffSec) * 3.6;
              
              // Eliminace statického driftu:
              // Pokud telefon hlásí pohyb (např. 4 km/h), ale fyzicky se souřadnice posunuly o méně než 1 metr,
              // jde pouze o odchylku GPS signálu na místě. Rychlost vynutíme na 0 km/h.
              if (calculatedSpeedKmh < 1.0 || (finalSpeed > 0 && distMeters < 1.0)) {
                 finalSpeed = 0;
              }
          }

          // Aktualizace stavu polohy
          setLocation({
              latitude: lat,
              longitude: lon,
              speed: finalSpeed,
              accuracy: accuracy != null ? accuracy : undefined,
              heading: heading != null ? heading : undefined,
          });
          
          // Aktualizace celkové maximální rychlosti (s perzistencí)
          if (finalSpeed > 0) {
              updateMaxSpeed(finalSpeed);
          }
          lastPosRef.current = { lat, lon, time: now };
          return;
      }

      // První inicializační poloha po zapnutí
      setLocation({
          latitude: lat,
          longitude: lon,
          speed: finalSpeed,
          accuracy: accuracy != null ? accuracy : undefined,
          heading: heading != null ? heading : undefined,
      });
      if (finalSpeed > 0) {
          updateMaxSpeed(finalSpeed);
      }
      lastPosRef.current = { lat, lon, time: now };
  }, [updateMaxSpeed]);

  // Metoda volaná z BLE hooku pro aktualizaci dat z externího ESP32 modulu
  const updateFromBLE = useCallback((lat: number, lon: number, speed: number) => {
      processLocation(lat, lon, speed);
  }, [processLocation]);

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
              processLocation(
                  pos.coords.latitude, 
                  pos.coords.longitude, 
                  (pos.coords.speed ?? 0) * 3.6, 
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
              (loc.coords.speed ?? 0) * 3.6, 
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
