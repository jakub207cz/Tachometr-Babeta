import { View, Text, Pressable, StyleSheet, Image, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAppMode } from "@/context/AppModeContext";

export default function HomeScreen() {
  const router = useRouter();
  const { setMode } = useAppMode();

  const handleStandalone = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setMode("standalone");
    router.push("/dashboard" as any);
  };

  const handleBLE = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setMode("ble");
    router.push("/ble-scan" as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>BABETA TACHOMETR</Text>
        <Text style={styles.subtitle}>Vintage Moped Dashboard</Text>
      </View>

      {/* Mode Buttons */}
      <View style={styles.buttonsContainer}>
        {/* Standalone Mode */}
        <Pressable
          onPress={handleStandalone}
          style={({ pressed }) => [
            styles.modeButton,
            styles.standaloneButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.buttonIconRow}>
            <Text style={styles.buttonIcon}>📍</Text>
            <Text style={[styles.buttonTitle, styles.cyanText]}>STANDALONE MODE</Text>
          </View>
          <Text style={styles.buttonDesc}>
            Uses your phone's built-in GPS for speed and navigation. No Bluetooth required.
          </Text>
          <View style={[styles.buttonBadge, styles.cyanBadge]}>
            <Text style={[styles.badgeText, styles.cyanText]}>GPS ONLY</Text>
          </View>
        </Pressable>

        {/* BLE Mode */}
        <Pressable
          onPress={handleBLE}
          style={({ pressed }) => [
            styles.modeButton,
            styles.bleButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.buttonIconRow}>
            <Text style={styles.buttonIcon}>🔵</Text>
            <Text style={[styles.buttonTitle, styles.orangeText]}>BABETTA BLE MODE</Text>
          </View>
          <Text style={styles.buttonDesc}>
            Connects to your moped's ESP32-C6 via Bluetooth. Receives live GPS and speed from the bike.
          </Text>
          <View style={[styles.buttonBadge, styles.orangeBadge]}>
            <Text style={[styles.badgeText, styles.orangeText]}>BLUETOOTH</Text>
          </View>
        </Pressable>
      </View>

      {/* Footer */}
      <Text style={styles.version}>v1.0.0 · Babeta Tachometr</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#00E5FF",
    letterSpacing: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    letterSpacing: 2,
    marginTop: 4,
    textTransform: "uppercase",
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  modeButton: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 24,
    backgroundColor: "#0D0D0D",
  },
  standaloneButton: {
    borderColor: "#00E5FF",
  },
  bleButton: {
    borderColor: "#FF6D00",
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  buttonIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  buttonIcon: {
    fontSize: 22,
  },
  buttonTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cyanText: {
    color: "#00E5FF",
  },
  orangeText: {
    color: "#FF6D00",
  },
  buttonDesc: {
    fontSize: 13,
    color: "#9BA1A6",
    lineHeight: 20,
    marginBottom: 14,
  },
  buttonBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  cyanBadge: {
    borderColor: "#00E5FF",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  orangeBadge: {
    borderColor: "#FF6D00",
    backgroundColor: "rgba(255,109,0,0.08)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  version: {
    textAlign: "center",
    color: "#374151",
    fontSize: 11,
    paddingBottom: 12,
    letterSpacing: 1,
  },
});
