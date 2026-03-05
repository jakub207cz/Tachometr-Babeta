import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

interface SpeedometerProps {
  speed: number; // km/h
}

export function Speedometer({ speed }: SpeedometerProps) {
  const displaySpeed = Math.round(Math.max(0, speed));
  const animatedValue = useRef(new Animated.Value(displaySpeed)).current;
  const displayRef = useRef(displaySpeed);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: displaySpeed,
      duration: 300,
      useNativeDriver: false,
    }).start();
    displayRef.current = displaySpeed;
  }, [displaySpeed]);

  // Format speed with leading zeros for consistent width
  const speedStr = displaySpeed.toString().padStart(3, " ");

  return (
    <View style={styles.container}>
      <View style={styles.speedRow}>
        <Text style={styles.speedDigits}>{speedStr}</Text>
      </View>
      <Text style={styles.unit}>km/h</Text>
      {/* Speed bar indicator */}
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, (displaySpeed / 80) * 100)}%`,
              backgroundColor: displaySpeed > 60 ? "#FF6D00" : displaySpeed > 40 ? "#FBBF24" : "#00E5FF",
            },
          ]}
        />
      </View>
      <View style={styles.barLabels}>
        {[0, 20, 40, 60, 80].map((v) => (
          <Text key={v} style={styles.barLabel}>{v}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 12,
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  speedDigits: {
    fontSize: 96,
    fontWeight: "900",
    color: "#00E5FF",
    fontFamily: "monospace",
    letterSpacing: -2,
    lineHeight: 100,
    textShadowColor: "rgba(0,229,255,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  unit: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 3,
    marginTop: -4,
    textTransform: "uppercase",
  },
  barContainer: {
    width: "80%",
    height: 4,
    backgroundColor: "#1C2A35",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginTop: 4,
  },
  barLabel: {
    color: "#374151",
    fontSize: 10,
  },
});
