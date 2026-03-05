# Smart Babeta — Mobile App Interface Design

## Concept
A high-contrast OLED dashboard for a vintage Babetta moped. The app runs in two modes:
- **Standalone Mode**: Uses phone GPS for speed and location.
- **Babetta BLE Mode**: Connects to an ESP32-C6 via Bluetooth and receives GPS + speed data from the moped's onboard unit.

---

## Color Palette

| Token       | Value       | Role                              |
|-------------|-------------|-----------------------------------|
| background  | `#000000`   | OLED true black background        |
| surface     | `#0D0D0D`   | Cards and panels                  |
| foreground  | `#ECEDEE`   | Primary text                      |
| muted       | `#6B7280`   | Secondary / disabled text         |
| primary     | `#00E5FF`   | Neon Cyan — speed, active states  |
| accent      | `#FF6D00`   | Neon Orange — warnings, BLE mode  |
| border      | `#1C2A35`   | Subtle dividers                   |
| success     | `#00E676`   | Connected / OK states             |
| error       | `#FF1744`   | Disconnected / error states       |

---

## Screen List

1. **Home Screen** — Mode selection landing page
2. **BLE Scan Screen** — Bluetooth device discovery and connection
3. **Dashboard Screen** — Live moped dashboard (shared by both modes)

---

## Screen Details

### 1. Home Screen
- Full OLED black background with the app logo/title centered at top
- Two large, full-width mode buttons stacked vertically:
  - **Standalone Mode** (Cyan border + icon: phone GPS)
  - **Babetta BLE Mode** (Orange border + icon: Bluetooth)
- Each button shows a subtitle describing the mode
- Subtle version text at bottom

### 2. BLE Scan Screen
- Header with back button and "Scan for Devices" title
- Scan button (Orange, pulsing animation when scanning)
- Empty state: "No devices found. Tap Scan to start." — NO mock devices
- Discovered device list: device name + RSSI signal strength indicator
- Tap device → connect → navigate to Dashboard
- Connection status indicator (connecting / connected / failed)

### 3. Dashboard Screen
**Layout (portrait, 9:16):**

```
┌─────────────────────────────┐
│  [← Back]    SMART BABETA   │  ← Header (status bar height)
├─────────────────────────────┤
│                             │
│       [  142  ]             │  ← Large digital speedometer (30%)
│        km/h                 │    Neon cyan digits, monospace font
│                             │
├─────────────────────────────┤
│  ● Connected (BLE/GPS)      │  ← Connection badge (20%)
│  ETA: 12 min  |  3.4 km    │    Navigation stats row
├─────────────────────────────┤
│                             │
│                             │
│      [  MAP  ]              │  ← Interactive OpenStreetMap (50%)
│                             │    Route overlay, user marker
│                             │
│              [⊕ Re-center] │  ← FAB bottom-right
└─────────────────────────────┘
```

---

## Key User Flows

### Flow A — Standalone Mode
1. Home → tap "Standalone Mode"
2. App requests location permission
3. Dashboard opens with GPS-based speed and position
4. Map auto-follows user location
5. User can search for destination via search bar
6. OSRM route drawn on map; ETA and distance shown

### Flow B — BLE Mode
1. Home → tap "Babetta BLE Mode"
2. BLE Scan Screen opens (empty list)
3. Tap "Scan" → real BLE devices appear
4. Tap ESP32-C6 device → connecting state
5. On connect → Dashboard opens
6. Speed and GPS data sourced from BLE characteristics (not phone GPS)
7. Map follows BLE-provided coordinates

### Flow C — Re-center
1. User pans/zooms map → auto-follow pauses (5 sec timer)
2. Re-center FAB appears highlighted
3. After 5 sec OR tap FAB → auto-follow resumes

---

## Typography
- Speedometer digits: `monospace` / `tabular-nums`, size 80–100
- Labels: `Inter` or system sans-serif
- Status badges: uppercase, letter-spacing 1.5

## Interaction Design
- All buttons: scale 0.97 + haptic on press
- BLE scan: pulsing orange ring animation
- Speed digits: smooth number transition (no jarring jumps)
- Map: standard pinch-zoom, pan gestures
