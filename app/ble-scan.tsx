import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useBLE, BLEDevice } from "@/context/BLEContext";

function RSSIBar({ rssi }: { rssi: number | null }) {
  const level = rssi == null ? 0 : rssi > -60 ? 4 : rssi > -75 ? 3 : rssi > -85 ? 2 : 1;
  return (
    <View style={rssiStyles.container}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={[
            rssiStyles.bar,
            { height: bar * 5 + 4 },
            bar <= level ? rssiStyles.barActive : rssiStyles.barInactive,
          ]}
        />
      ))}
    </View>
  );
}

const rssiStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 5, borderRadius: 2 },
  barActive: { backgroundColor: "#00E5FF" },
  barInactive: { backgroundColor: "#1C2A35" },
});

function DeviceItem({
  device,
  onConnect,
  isConnecting,
}: {
  device: BLEDevice;
  onConnect: (d: BLEDevice) => void;
  isConnecting: boolean;
}) {
  return (
    <Pressable
      onPress={() => onConnect(device)}
      disabled={isConnecting}
      style={({ pressed }) => [
        styles.deviceItem,
        pressed && styles.deviceItemPressed,
      ]}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name ?? "Neznámé zařízení"}</Text>
        <Text style={styles.deviceId}>{device.id}</Text>
      </View>
      <View style={styles.deviceRight}>
        <RSSIBar rssi={device.rssi} />
        {device.rssi != null && (
          <Text style={styles.rssiText}>{device.rssi} dBm</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function BleScanScreen() {
  const router = useRouter();
  const { devices, connectionState, connectedDevice, errorMessage, startScan, stopScan, connectToDevice } = useBLE();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const isScanning = connectionState === "scanning";
  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState === "connected";

  // Pulzní animace při skenování
  useEffect(() => {
    if (isScanning) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [isScanning]);

  // Po připojení přejděte na řídicí panel
  useEffect(() => {
    if (isConnected && connectedDevice) {
      const timer = setTimeout(() => {
        router.replace("/dashboard" as any);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectedDevice]);

  const handleScan = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isScanning) {
      stopScan();
    } else {
      startScan();
    }
  };

  const handleConnect = async (device: BLEDevice) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await connectToDevice(device);
  };

  const handleBack = () => {
    stopScan();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      {/* Záhlaví */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Zpět</Text>
        </Pressable>
        <Text style={styles.headerTitle}>VYHLEDÁVÁNÍ BLUETOOTH</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tlačítko skenování */}
      <View style={styles.scanSection}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handleScan}
            disabled={isConnecting || isConnected}
            style={({ pressed }) => [
              styles.scanButton,
              isScanning && styles.scanButtonActive,
              pressed && styles.scanButtonPressed,
            ]}
          >
            {isScanning ? (
              <ActivityIndicator color="#FF6D00" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Text style={styles.scanButtonIcon}>🔍</Text>
            )}
            <Text style={[styles.scanButtonText, isScanning && styles.scanButtonTextActive]}>
              {isScanning ? "VYHLEDÁVÁM..." : "VYHLEDAT ZAŘÍZENÍ"}
            </Text>
          </Pressable>
        </Animated.View>

        {isScanning && (
          <Text style={styles.scanHint}>Vyhledávám blízká Bluetooth zařízení…</Text>
        )}
      </View>

      {/* Stavové zprávy */}
      {errorMessage != null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {errorMessage}</Text>
        </View>
      )}

      {isConnecting && (
        <View style={styles.connectingBanner}>
          <ActivityIndicator color="#FF6D00" size="small" />
          <Text style={styles.connectingText}>Připojování k zařízení…</Text>
        </View>
      )}

      {isConnected && connectedDevice && (
        <View style={styles.connectedBanner}>
          <Text style={styles.connectedText}>✓ Připojeno k {connectedDevice.name ?? connectedDevice.id}</Text>
        </View>
      )}

      {/* Seznam zařízení */}
      <View style={styles.listContainer}>
        <Text style={styles.listHeader}>
          {devices.length > 0 ? `NALEZENÁ ZAŘÍZENÍ (${devices.length})` : "NALEZENÁ ZAŘÍZENÍ"}
        </Text>

        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>Žádná zařízení nebyla nalezena</Text>
            <Text style={styles.emptyDesc}>
              {isScanning
                ? "Vyhledávám blízká Bluetooth zařízení…"
                : "Klepnutím na „Vyhledat zařízení“ spustíte vyhledávání GPS modulu Babetty."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DeviceItem
                device={item}
                onConnect={handleConnect}
                isConnecting={isConnecting || isConnected}
              />
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Poznámka k platformě */}
      {Platform.OS === "web" && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            Vyhledávání Bluetooth je dostupné pouze na zařízeních Android/iOS.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: "#00E5FF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#ECEDEE",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  scanSection: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF6D00",
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: "rgba(255,109,0,0.06)",
    gap: 8,
  },
  scanButtonActive: {
    backgroundColor: "rgba(255,109,0,0.12)",
    borderColor: "#FF6D00",
  },
  scanButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  scanButtonIcon: {
    fontSize: 18,
  },
  scanButtonText: {
    color: "#FF6D00",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  scanButtonTextActive: {
    color: "#FF6D00",
  },
  scanHint: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(255,23,68,0.12)",
    borderWidth: 1,
    borderColor: "#FF1744",
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: "#FF1744",
    fontSize: 13,
  },
  connectingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(255,109,0,0.08)",
    borderWidth: 1,
    borderColor: "#FF6D00",
    borderRadius: 8,
    padding: 12,
  },
  connectingText: {
    color: "#FF6D00",
    fontSize: 13,
    fontWeight: "600",
  },
  connectedBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(0,230,118,0.08)",
    borderWidth: 1,
    borderColor: "#00E676",
    borderRadius: 8,
    padding: 12,
  },
  connectedText: {
    color: "#00E676",
    fontSize: 13,
    fontWeight: "600",
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#ECEDEE",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyDesc: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1C2A35",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  deviceItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  deviceName: {
    color: "#ECEDEE",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  deviceId: {
    color: "#6B7280",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  deviceRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  rssiText: {
    color: "#6B7280",
    fontSize: 10,
  },
  webNote: {
    margin: 16,
    padding: 12,
    backgroundColor: "#0D0D0D",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1C2A35",
  },
  webNoteText: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
});
