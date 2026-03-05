import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { RoutePoint } from "@/context/NavigationContext";

interface MapViewProps {
  latitude: number | null;
  longitude: number | null;
  route: RoutePoint[];
  autoFollow: boolean;
  onMapInteraction: () => void;
}

function buildMapHTML(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #0D0D0D; }
  .leaflet-tile-pane { filter: brightness(0.85) saturate(0.7); }
  .user-marker { 
    width: 18px; height: 18px; 
    background: #00E5FF; 
    border-radius: 50%; 
    border: 3px solid #000;
    box-shadow: 0 0 12px rgba(0,229,255,0.8);
  }
  .dest-marker {
    width: 14px; height: 14px;
    background: #FF6D00;
    border-radius: 50%;
    border: 2px solid #000;
    box-shadow: 0 0 10px rgba(255,109,0,0.7);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    center: [${lat}, ${lon}],
    zoom: 15,
    zoomControl: false,
    attributionControl: false
  });

  // Use const tile layer (never recreate)
  var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
    userAgent: 'com.smart.babeta.app'
  }).addTo(map);

  var userIcon = L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  var destIcon = L.divIcon({ className: '', html: '<div class="dest-marker"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

  var userMarker = L.marker([${lat}, ${lon}], { icon: userIcon }).addTo(map);
  var destMarker = null;
  var routePolyline = null;
  var autoFollow = true;
  var isUserInteracting = false;
  var interactionTimer = null;
  var lastInteractionTime = 0;

  // 10-second auto-follow pause with interaction tracking
  map.on('dragstart zoomstart', function() {
    isUserInteracting = true;
    autoFollow = false;
    lastInteractionTime = Date.now();
    clearTimeout(interactionTimer);
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interaction' }));
    
    // Schedule auto-follow resume after 10 seconds of no interaction
    interactionTimer = setTimeout(function() {
      isUserInteracting = false;
      autoFollow = true;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autoFollowResume' }));
    }, 10000);
  });

  map.on('dragend zoomend', function() {
    // Reset timer on drag/zoom end
    lastInteractionTime = Date.now();
    clearTimeout(interactionTimer);
    interactionTimer = setTimeout(function() {
      isUserInteracting = false;
      autoFollow = true;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autoFollowResume' }));
    }, 10000);
  });

  // Smooth camera transition with animation (only update marker, not entire map)
  function updatePosition(lat, lon) {
    userMarker.setLatLng([lat, lon]);
    if (autoFollow && !isUserInteracting) {
      // Smooth animation: 500ms duration
      map.setView([lat, lon], map.getZoom(), { animate: true, duration: 0.5 });
    }
  }

  // Persistent route: only update if route data changes, never clear on position updates
  function setRoute(points) {
    if (routePolyline) { 
      map.removeLayer(routePolyline); 
    }
    if (points && points.length > 1) {
      routePolyline = L.polyline(points, { 
        color: '#00E5FF', 
        weight: 4, 
        opacity: 0.85, 
        dashArray: null,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    } else {
      routePolyline = null;
    }
  }

  // Persistent destination marker
  function setDestination(lat, lon) {
    if (destMarker) { 
      map.removeLayer(destMarker); 
    }
    destMarker = L.marker([lat, lon], { icon: destIcon }).addTo(map);
  }

  // Clear route and destination
  function clearRoute() {
    if (routePolyline) { 
      map.removeLayer(routePolyline);
      routePolyline = null;
    }
    if (destMarker) { 
      map.removeLayer(destMarker);
      destMarker = null;
    }
  }

  // Smooth recenter with animation
  function recenter(lat, lon) {
    isUserInteracting = false;
    autoFollow = true;
    clearTimeout(interactionTimer);
    // 1-second smooth animation
    map.setView([lat, lon], 15, { animate: true, duration: 1.0 });
  }

  // Check if user is currently interacting
  function getIsUserInteracting() {
    return isUserInteracting;
  }

  // Expose functions to React Native
  window.updatePosition = updatePosition;
  window.setRoute = setRoute;
  window.setDestination = setDestination;
  window.clearRoute = clearRoute;
  window.recenter = recenter;
  window.setAutoFollow = function(val) { autoFollow = val; };
  window.getIsUserInteracting = getIsUserInteracting;
</script>
</body>
</html>`;
}

function OSMMapViewComponent({ latitude, longitude, route, autoFollow, onMapInteraction }: MapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const isLoadedRef = useRef(false);
  const pendingUpdatesRef = useRef<Array<() => void>>([]);
  const previousRouteRef = useRef<RoutePoint[]>([]);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const execJS = useCallback((js: string) => {
    if (isLoadedRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(js + "; true;");
    } else {
      pendingUpdatesRef.current.push(() => {
        webViewRef.current?.injectJavaScript(js + "; true;");
      });
    }
  }, []);

  // Update user position (NEVER clears route) — only marker moves
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    execJS(`updatePosition(${latitude}, ${longitude})`);
  }, [latitude, longitude, execJS]);

  // Update route ONLY when route data actually changes
  useEffect(() => {
    const routeChanged =
      route.length !== previousRouteRef.current.length ||
      (route.length > 0 &&
        (route[0].latitude !== previousRouteRef.current[0]?.latitude ||
          route[0].longitude !== previousRouteRef.current[0]?.longitude));

    if (routeChanged) {
      previousRouteRef.current = route;
      if (route.length === 0) {
        execJS(`clearRoute()`);
      } else {
        const pointsJson = JSON.stringify(route.map((p) => [p.latitude, p.longitude]));
        execJS(`setRoute(${pointsJson})`);
      }
    }
  }, [route, execJS]);

  // Update auto-follow state
  useEffect(() => {
    execJS(`setAutoFollow(${autoFollow})`);
    if (autoFollow && latitude != null && longitude != null && !isUserInteracting) {
      execJS(`recenter(${latitude}, ${longitude})`);
    }
  }, [autoFollow, latitude, longitude, isUserInteracting, execJS]);

  const handleLoad = () => {
    isLoadedRef.current = true;
    pendingUpdatesRef.current.forEach((fn) => fn());
    pendingUpdatesRef.current = [];
  };

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "interaction") {
        setIsUserInteracting(true);
        onMapInteraction();
      } else if (msg.type === "autoFollowResume") {
        setIsUserInteracting(false);
      }
    } catch { }
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <View style={styles.webFallbackInner} />
      </View>
    );
  }

  // Ensure the initial HTML is generated only once using the first valid coordinates
  // so the WebView doesn't completely reload its source on every GPS tick.
  const initialLatRef = useRef<number>(latitude ?? 48.8566);
  const initialLonRef = useRef<number>(longitude ?? 2.3522);

  if (latitude && initialLatRef.current === 48.8566) {
    initialLatRef.current = latitude;
  }
  if (longitude && initialLonRef.current === 2.3522) {
    initialLonRef.current = longitude;
  }

  const mapSourceHtml = useMemo(
    () => buildMapHTML(initialLatRef.current, initialLonRef.current),
    []
  );

  return (
    <WebView
      ref={webViewRef}
      source={{ html: mapSourceHtml }}
      style={styles.map}
      onLoad={handleLoad}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
      mixedContentMode="always"
      allowsInlineMediaPlayback
      scrollEnabled={false}
    />
  );
}

// Memoize to prevent re-renders unless props actually change
export const OSMMapView = React.memo(OSMMapViewComponent, (prevProps, nextProps) => {
  // Return true if props are equal (no re-render), false if different (re-render)
  return (
    prevProps.latitude === nextProps.latitude &&
    prevProps.longitude === nextProps.longitude &&
    prevProps.autoFollow === nextProps.autoFollow &&
    prevProps.route === nextProps.route &&
    prevProps.onMapInteraction === nextProps.onMapInteraction
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  webFallback: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  webFallbackInner: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0D0D0D",
  },
});
