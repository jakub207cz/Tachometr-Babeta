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
  isNavigating: false,
};

const NavigationContext = createContext<NavigationContextType>({
  ...defaultState,
  setDestination: () => {},
  fetchRoute: async () => {},
  clearNavigation: () => {},
  updateNavigationProgress: () => {},
});

// Decode OSRM polyline (encoded polyline algorithm)
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
  
  // Track last recalculation time to prevent API spam
  const lastRecalculationRef = useRef<number>(0);

  const setDestination = useCallback((point: RoutePoint, name: string) => {
    setState((prev) => ({ ...prev, destination: point, destinationName: name }));
  }, []);

  const fetchRoute = useCallback(async (from: RoutePoint, to: RoutePoint) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline`;
      const res = await fetch(url, {
        headers: { "User-Agent": "com.smart.babeta.app" },
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

        // Calculate distance from user to the route line (in km, converted to meters)
        const distanceToRouteMeters = pointToLineDistance(userPoint, routeLine, { units: "kilometers" }) * 1000;

        // If off-route by > 50 meters, trigger recalculation (debounced to once every 1 second)
        if (distanceToRouteMeters > 50) {
          const now = Date.now();
          if (now - lastRecalculationRef.current > 1000) {
            lastRecalculationRef.current = now;
            // Fire async fetchRoute without awaiting to avoid blocking state update
            fetchRoute(
              { latitude: location.latitude, longitude: location.longitude },
              prevState.destination
            );
          }
          return prevState;
        }

        // Snap user to the nearest point on the route
        const snappedPoint = nearestPointOnLine(routeLine, userPoint);
        
        // Calculate remaining distance from snapped point to the end of the route
        const destinationPoint = turf.point([prevState.destination.longitude, prevState.destination.latitude]);
        
        // Find index of snapped point to only calculate distance along remaining path
        const snappedIndex = snappedPoint.properties.index || 0;
        
        // Create remaining path from snapped point to destination
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

        // Average moped speed assumption for ETA if actual speed is too low/zero
        const speedKmh = location.speed > 5 ? location.speed : 5; // Min 5 km/h assumed for ETA if standing still (e.g. pushing/crawling tight spots)
        const speedMs = speedKmh / 3.6;
        const newDurationSeconds = remainingDistanceMeters / speedMs;
        
        // Auto-stop navigation if within 20 meters of destination
        if (remainingDistanceMeters < 20) {
            return {
              ...defaultState,
              destination: null,
              destinationName: null,
              route: [],
              distanceMeters: null,
              durationSeconds: null,
              isNavigating: false,
            };
        }

        return {
          ...prevState,
          distanceMeters: remainingDistanceMeters,
          durationSeconds: newDurationSeconds,
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
