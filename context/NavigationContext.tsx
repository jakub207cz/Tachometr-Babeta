import React, { createContext, useContext, useState, useCallback } from "react";

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

  const clearNavigation = useCallback(() => {
    setState(defaultState);
  }, []);

  return (
    <NavigationContext.Provider value={{ ...state, setDestination, fetchRoute, clearNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
