import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as turf from "@turf/helpers";
import distance from "@turf/distance";
import pointToLineDistance from "@turf/point-to-line-distance";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { LocationData } from "./LocationContext";

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface NavigationState {
  destination: RoutePoint | null;
  destinationName: string | null;
  route: RoutePoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  routeMaxSpeed: number; // Maximální rychlost během této konkrétní trasy
  baselineDurationSeconds: number | null; // Původní ETA generovaný OSRM API
  initialRouteDistanceMeters: number | null; // Původní vzdálenost trasy pro výpočet procent
  isNavigating: boolean;
}

interface NavigationContextType extends NavigationState {
  setDestination: (point: RoutePoint, name: string) => void;
  fetchRoute: (from: RoutePoint, to: RoutePoint) => Promise<void>;
  clearNavigation: () => void;
  updateNavigationProgress: (location: LocationData) => void;
}

const defaultState: NavigationState = {
  destination: null,
  destinationName: null,
  route: [],
  distanceMeters: null,
  durationSeconds: null,
  routeMaxSpeed: 0,
  baselineDurationSeconds: null,
  initialRouteDistanceMeters: null,
  isNavigating: false,
};

const NavigationContext = createContext<NavigationContextType>({
  ...defaultState,
  setDestination: () => {},
  fetchRoute: async () => {},
  clearNavigation: () => {},
  updateNavigationProgress: () => {},
});

// Dekódovat křivku OSRM (algoritmus kódované křivky)
function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigationState>(defaultState);
  
  // Sledujte čas posledního přepočtu, abyste zabránili spamu API
  const lastRecalculationRef = useRef<number>(0);

  const setDestination = useCallback((point: RoutePoint, name: string) => {
    setState((prev) => ({ ...prev, destination: point, destinationName: name }));
  }, []);

  const fetchRoute = useCallback(async (from: RoutePoint, to: RoutePoint) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline`;
      const res = await fetch(url, {
        headers: { "User-Agent": "com.smart.babetta.app" },
      });
      const data = await res.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        console.warn("OSRM route error:", data.message);
        return;
      }

      const route = data.routes[0];
      const decodedPoints = decodePolyline(route.geometry);

      setState((prev) => ({
        ...prev,
        route: decodedPoints,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        routeMaxSpeed: 0, // Resetovat při zahájení nové trasy
        baselineDurationSeconds: route.duration,
        initialRouteDistanceMeters: route.distance,
        isNavigating: true,
      }));
    } catch (e) {
      console.warn("Route fetch error:", e);
    }
  }, []);

  const updateNavigationProgress = useCallback(
    (location: LocationData) => {
      setState((prevState) => {
        if (!prevState.isNavigating || !prevState.destination || prevState.route.length < 2) {
          return prevState;
        }

        const userPoint = turf.point([location.longitude, location.latitude]);
        const routeLine = turf.lineString(prevState.route.map((p) => [p.longitude, p.latitude]));

        // Vypočítat vzdálenost od uživatele k linii trasy (v km, převedeno na metry)
        const distanceToRouteMeters = pointToLineDistance(userPoint, routeLine, { units: "kilometers" }) * 1000;

        // Pokud jste mimo trasu o > 50 metrů A pohybují se, spusťte přepočet (odskočeno jednou za 1 sekundu)
        // Tím se zabrání okamžitým přepočtům při spuštění kvůli šumu/driftu GPS
        if (distanceToRouteMeters > 50 && location.speed > 0) {
          const now = Date.now();
          if (now - lastRecalculationRef.current > 1000) {
            lastRecalculationRef.current = now;
            // Spusťte asynchronní fetchRoute bez čekání, aby nedošlo k zablokování aktualizace stavu
            fetchRoute(
              { latitude: location.latitude, longitude: location.longitude },
              prevState.destination
            );
          }
          return prevState;
        }

        // Přichyťte uživatele k nejbližšímu bodu na trase
        const snappedPoint = nearestPointOnLine(routeLine, userPoint);
        
        // Vypočítejte zbývající vzdálenost od bodu přichycení ke konci trasy
        const destinationPoint = turf.point([prevState.destination.longitude, prevState.destination.latitude]);
        
        // Najděte index uchopeného bodu, abyste vypočítali pouze vzdálenost podél zbývající cesty
        const snappedIndex = snappedPoint.properties.index || 0;
        
        let remainingDistanceMeters = 0;
        
        if (snappedIndex < prevState.route.length - 1) {
            const nextPoint = turf.point([prevState.route[snappedIndex + 1].longitude, prevState.route[snappedIndex + 1].latitude]);
            remainingDistanceMeters += distance(snappedPoint, nextPoint, { units: "kilometers" }) * 1000;
            
            for (let i = snappedIndex + 1; i < prevState.route.length - 1; i++) {
                const pt1 = turf.point([prevState.route[i].longitude, prevState.route[i].latitude]);
                const pt2 = turf.point([prevState.route[i + 1].longitude, prevState.route[i + 1].latitude]);
                remainingDistanceMeters += distance(pt1, pt2, { units: "kilometers" }) * 1000;
            }
        }

        // Chytrý výpočet ETA založený na pokroku vs. základní linie, který zabraňuje divokým skokům
        let newDurationSeconds = prevState.durationSeconds;
        
        if (prevState.baselineDurationSeconds != null && prevState.initialRouteDistanceMeters != null && prevState.initialRouteDistanceMeters > 0) {
            const progressPercentage = Math.max(0, Math.min(1, remainingDistanceMeters / prevState.initialRouteDistanceMeters));
            
            // Zbývající čas základní linie založený čistě na ujeté vzdálenosti
            // To je zcela stabilní a při zrychlování nebo zpomalování neskočí
            newDurationSeconds = prevState.baselineDurationSeconds * progressPercentage;
        }

        // Aktualizujte maximální rychlost pro tuto trasu
        const currentRouteMaxSpeed = Math.max(prevState.routeMaxSpeed, location.speed);

        // Automatické zastavení navigace, pokud je do 20 metrů od cíle
        if (remainingDistanceMeters < 20) {
            return defaultState;
        }

        return {
          ...prevState,
          distanceMeters: remainingDistanceMeters,
          durationSeconds: newDurationSeconds,
          routeMaxSpeed: currentRouteMaxSpeed,
        };
      });
    },
    [fetchRoute]
  );

  const clearNavigation = useCallback(() => {
    setState(defaultState);
  }, []);

  return (
    <NavigationContext.Provider value={{ ...state, setDestination, fetchRoute, clearNavigation, updateNavigationProgress }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
