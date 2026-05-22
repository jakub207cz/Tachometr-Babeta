import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import * as turf from "@turf/helpers";
import distance from "@turf/distance";
import rhumbBearing from "@turf/rhumb-bearing";
import nearestPointOnLine from "@turf/nearest-point-on-line";

import { useAppMode } from "@/context/AppModeContext";
import { useLocation } from "@/context/LocationContext";
import { useBLE } from "@/context/BLEContext";
import { useNavigation } from "@/context/NavigationContext";
import { Speedometer } from "@/components/Speedometer";
import { OSMMapView } from "@/components/MapView";
import { SearchBar, SearchResult } from "@/components/SearchBar";
import { useBLEData } from "@/hooks/useBLEData";
import { useSafeTimer } from "@/hooks/useSafeTimer";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatDistance(meters: number | null): string {
  if (meters == null) return "--";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function DashboardScreen() {
  // Keep screen awake during navigation session
  useKeepAwake();
  // Poll BLE data when in BLE mode
  useBLEData();

  const router = useRouter();
  const { mode } = useAppMode();
  const { location, maxSpeed } = useLocation();
  const { connectedDevice, connectionState: bleState } = useBLE();
  const { route, distanceMeters, durationSeconds, routeMaxSpeed, isNavigating, setDestination, fetchRoute, clearNavigation } = useNavigation();

  const [autoFollow, setAutoFollow] = useState(true);
  const [mapZoom, setMapZoom] = useState(15);
  const [showRecenter, setShowRecenter] = useState(false);
  const { setTimer: setAutoFollowTimer, clearTimer: clearAutoFollowTimer, resetTimer: resetAutoFollowTimer } = useSafeTimer();

  const isBLEMode = mode === "ble";
  const isConnected = isBLEMode ? bleState === "connected" : location != null;

  const connectionLabel = isBLEMode
    ? bleState === "connected"
      ? `BLE · ${connectedDevice?.name ?? "Smart Babetta GPS"}`
      : "BLE · Odpojeno"
    : location != null
    ? "GPS · Aktivní"
    : "GPS · Vyhledávání signálu…";

  const connectionColor = isConnected ? "#00E676" : "#FF1744";

  // 10-second auto-follow pause with interaction tracking
  const handleMapInteraction = useCallback(() => {
    setAutoFollow(false);
    setShowRecenter(true);
    // 10-second pause before auto-follow resumes
    resetAutoFollowTimer(() => {
      setAutoFollow(true);
      setShowRecenter(false);
    }, 10000);
  }, [resetAutoFollowTimer]);

  const handleRecenter = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAutoFollow(true);
    setShowRecenter(false);
    // Restart 10-second timer after manual recenter
    resetAutoFollowTimer(() => {
      setAutoFollow(false);
    }, 10000);
  }, [resetAutoFollowTimer]);

  const handleSearchResult = useCallback(
    async (result: SearchResult) => {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      setDestination({ latitude: lat, longitude: lon }, result.display_name);

      if (location) {
        await fetchRoute(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: lat, longitude: lon }
        );
      }
    },
    [location, setDestination, fetchRoute]
  );

  const handleClearRoute = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    clearNavigation();
  }, [clearNavigation]);

  const handleBack = useCallback(() => {
    clearNavigation();
    router.back();
  }, [clearNavigation, router]);

  useEffect(() => {
    return () => {
      clearAutoFollowTimer();
    };
  }, [clearAutoFollowTimer]);

  const { updateNavigationProgress } = useNavigation();

  useEffect(() => {
    if (isNavigating && location) {
      updateNavigationProgress(location);

      if (route.length > 2) {
        try {
          // Vytvoříme bod z aktuální pozice jezdce
          const userPoint = turf.point([location.longitude, location.latitude]);
          // Převedeme trasu na čáru (LineString) pro knihovnu Turf
          const routeLine = turf.lineString(route.map(p => [p.longitude, p.latitude]));
          // Najdeme nejbližší bod na trase k pozici uživatele (přichycení k trase)
          const snapped = nearestPointOnLine(routeLine, userPoint);
          const currentIndex = snapped.properties.index || 0;

          let distToNextTurn = 0;
          let foundTurn = false;
          
          // Budeme se dívat dopředu až o 20 bodů trasy pro detekci zatáček
          const lookaheadEnd = Math.min(currentIndex + 20, route.length - 2);
          
          for (let i = currentIndex; i < lookaheadEnd; i++) {
              const p1 = turf.point([route[i].longitude, route[i].latitude]);
              const p2 = turf.point([route[i+1].longitude, route[i+1].latitude]);
              const p3 = turf.point([route[i+2].longitude, route[i+2].latitude]);
              
              // Připočítáme vzdálenost mezi body v metrech
              distToNextTurn += distance(p1, p2, { units: "kilometers" }) * 1000;
              
              // Spočítáme azimut (úhel směru) před a za uzlovým bodem
              const bearing1 = rhumbBearing(p1, p2);
              const bearing2 = rhumbBearing(p2, p3);
              
              // Rozdíl úhlů obou směrů (s ošetřením přechodu přes 360 stupňů)
              let angleDiff = Math.abs(bearing1 - bearing2);
              if (angleDiff > 180) angleDiff = 360 - angleDiff;
              
              // Pokud je změna směru větší než 30°, považujeme to za zatáčku nebo křižovatku
              if (angleDiff > 30) {
                  foundTurn = true;
                  break;
              }
          }

          // Smart Zoom algoritmus:
          // Pokud je před námi zatáčka do 100 metrů, automaticky přiblížíme mapu (zoom 18)
          // na detail křižovatky. V opačném případě oddálíme na přehledný zoom 15.
          if (foundTurn && distToNextTurn < 100) {
              setMapZoom(18);
          } else {
              setMapZoom(15);
          }
        } catch (e) {
           // V případě chyby (např. nekonzistentní data trasy) ponecháme základní zoom
        }
      }
    } else {
        setMapZoom(15);
    }
  }, [isNavigating, location, route, updateNavigationProgress]);

  const speed = location?.speed ?? 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← Zpět</Text>
          </Pressable>
          <Text style={styles.headerTitle}>BABETTA TACHOMETR</Text>
          <View style={styles.modeBadge}>
            <Text style={[styles.modeText, { color: isBLEMode ? "#FF6D00" : "#00E5FF" }]}>
              {isBLEMode ? "BLE" : "GPS"}
            </Text>
          </View>
        </View>

        {/* ── Max Speed Bar (New) ── */}
        <View style={styles.maxSpeedBar}>
           <Text style={styles.maxSpeedText}>
               <Text style={styles.maxSpeedLabel}>MAX TRASA: </Text>
               {Math.round(routeMaxSpeed)} km/h
           </Text>
           <Text style={styles.maxSpeedText}>
               <Text style={styles.maxSpeedLabel}>CELKOVÉ MAX: </Text>
               {Math.round(maxSpeed)} km/h
           </Text>
        </View>

        {/* ── Top 30%: Speedometer ── */}
        <View style={styles.speedometerSection}>
          <Speedometer speed={speed} />
        </View>

        {/* ── Middle 20%: Status + Nav Stats ── */}
        <View style={styles.statsSection}>
          {/* Connection status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: connectionColor }]} />
            <Text style={[styles.statusText, { color: connectionColor }]}>
              {connectionLabel}
            </Text>
          </View>

          {/* Nav stats */}
          {isNavigating ? (
            <View style={styles.navStats}>
              <View style={styles.navStatItem}>
                <Text style={styles.navStatLabel}>DOJEZD</Text>
                <Text style={styles.navStatValue}>{formatDuration(durationSeconds)}</Text>
              </View>
              <View style={styles.navDivider} />
              <View style={styles.navStatItem}>
                <Text style={styles.navStatLabel}>VZDÁLENOST</Text>
                <Text style={styles.navStatValue}>{formatDistance(distanceMeters)}</Text>
              </View>
              <Pressable onPress={handleClearRoute} style={styles.clearRouteBtn}>
                <Text style={styles.clearRouteText}>✕ Vymazat</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.searchWrapper}>
              <SearchBar onSelectResult={handleSearchResult} />
            </View>
          )}
        </View>

        {/* ── Bottom 50%: Map ── */}
        <View style={styles.mapSection}>
          <OSMMapView
            latitude={location?.latitude ?? null}
            longitude={location?.longitude ?? null}
            route={route}
            autoFollow={autoFollow}
            zoomLevel={mapZoom}
            onMapInteraction={handleMapInteraction}
          />

          {/* Re-center FAB */}
          {showRecenter && (
            <Pressable
              onPress={handleRecenter}
              style={({ pressed }) => [styles.recenterFab, pressed && styles.recenterFabPressed]}
            >
              <Text style={styles.recenterIcon}>⊕</Text>
              <Text style={styles.recenterText}>Centrovat</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#ECEDEE",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1C2A35",
    backgroundColor: "#0D0D0D",
  },
  modeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // Max Speed Bar
  maxSpeedBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#0D0D0D",
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
  },
  maxSpeedText: {
    color: "#ECEDEE",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  maxSpeedLabel: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },

  // Speedometer — top 30%
  speedometerSection: {
    flex: 3,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
    backgroundColor: "#000000",
  },

  // Stats — middle 20%
  statsSection: {
    flex: 2,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
    backgroundColor: "#000000",
    zIndex: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  navStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navStatItem: {
    alignItems: "center",
  },
  navStatLabel: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  navStatValue: {
    color: "#00E5FF",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  navDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#1C2A35",
  },
  clearRouteBtn: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF1744",
    backgroundColor: "rgba(255,23,68,0.08)",
  },
  clearRouteText: {
    color: "#FF1744",
    fontSize: 12,
    fontWeight: "600",
  },
  searchWrapper: {
    flex: 1,
    justifyContent: "center",
  },

  // Map — bottom 50%
  mapSection: {
    flex: 5,
    position: "relative",
    overflow: "hidden",
  },
  recenterFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0D0D0D",
    borderWidth: 1.5,
    borderColor: "#00E5FF",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#00E5FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  recenterFabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  recenterIcon: {
    color: "#00E5FF",
    fontSize: 18,
    fontWeight: "700",
  },
  recenterText: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
