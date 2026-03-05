import { describe, it, expect } from "vitest";

// ── Test: OSRM polyline decoder ──────────────────────────────────────────────
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
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

// ── Test: formatDuration ─────────────────────────────────────────────────────
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ── Test: formatDistance ─────────────────────────────────────────────────────
function formatDistance(meters: number | null): string {
  if (meters == null) return "--";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ── Test: speed conversion ───────────────────────────────────────────────────
function msToKmh(speedMs: number): number {
  return Math.max(0, speedMs * 3.6);
}

describe("Smart Babeta — Core Utilities", () => {
  describe("OSRM Polyline Decoder", () => {
    it("decodes a simple encoded polyline", () => {
      // Known encoded polyline for Paris area
      const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
      const points = decodePolyline(encoded);
      expect(points.length).toBe(3);
      expect(points[0].latitude).toBeCloseTo(38.5, 0);
      expect(points[0].longitude).toBeCloseTo(-120.2, 0);
    });

    it("returns empty array for empty string", () => {
      const points = decodePolyline("");
      expect(points).toEqual([]);
    });

    it("decodes single point", () => {
      // Encoded point for lat=48.8566, lon=2.3522 (Paris)
      const encoded = "yy`|HkiuM";
      const points = decodePolyline(encoded);
      expect(points.length).toBe(1);
    });
  });

  describe("formatDuration", () => {
    it("returns -- for null", () => {
      expect(formatDuration(null)).toBe("--");
    });

    it("formats minutes correctly", () => {
      expect(formatDuration(600)).toBe("10 min");
      expect(formatDuration(3540)).toBe("59 min");
    });

    it("formats hours and minutes correctly", () => {
      expect(formatDuration(3600)).toBe("1h 0m");
      expect(formatDuration(5400)).toBe("1h 30m");
      expect(formatDuration(7260)).toBe("2h 1m");
    });

    it("rounds seconds to nearest minute", () => {
      expect(formatDuration(90)).toBe("2 min");
      expect(formatDuration(89)).toBe("1 min");
    });
  });

  describe("formatDistance", () => {
    it("returns -- for null", () => {
      expect(formatDistance(null)).toBe("--");
    });

    it("formats meters for short distances", () => {
      expect(formatDistance(500)).toBe("500 m");
      expect(formatDistance(999)).toBe("999 m");
    });

    it("formats kilometers for long distances", () => {
      expect(formatDistance(1000)).toBe("1.0 km");
      expect(formatDistance(3400)).toBe("3.4 km");
      expect(formatDistance(12500)).toBe("12.5 km");
    });
  });

  describe("Speed Conversion (m/s → km/h)", () => {
    it("converts correctly", () => {
      expect(msToKmh(0)).toBe(0);
      expect(msToKmh(10)).toBeCloseTo(36, 1);
      expect(msToKmh(13.89)).toBeCloseTo(50, 0);
    });

    it("clamps negative values to 0", () => {
      expect(msToKmh(-5)).toBe(0);
    });
  });
});
