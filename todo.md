# Smart Babeta — TODO

## Setup & Configuration
- [x] Configure OLED dark theme colors in theme.config.js
- [x] Install required packages (expo-location, react-native-maps, BLE library)
- [x] Configure app.config.ts with branding and permissions
- [x] Generate app icon/logo

## Screens
- [x] Home Screen — two mode selection buttons (Standalone / BLE)
- [x] BLE Scan Screen — real device discovery, no mock devices
- [x] Dashboard Screen — speedometer + map + nav stats

## Dashboard Features
- [x] Large digital speedometer (km/h) — top 30%
- [x] Connection status badge (GPS / BLE)
- [x] Navigation stats row (ETA + Distance) — middle 20%
- [x] Interactive OpenStreetMap — bottom 50%
- [x] Auto-follow user location on map
- [x] Pan/zoom pauses auto-follow for 5 seconds then resumes
- [x] Re-center FAB button

## Navigation & Map
- [x] OpenStreetMap tiles via WebView+Leaflet.js
- [x] OSRM routing (no API key required)
- [x] Nominatim address search
- [x] Route polyline drawn on map
- [x] ETA and distance calculation from OSRM response

## GPS / Location
- [x] Request location permissions
- [x] Subscribe to GPS location updates (Standalone Mode)
- [x] Extract speed from GPS coords
- [x] LocationProvider context

## BLE Connectivity
- [x] BLE scan with react-native-ble-plx
- [x] Empty scan list by default (no mock devices)
- [x] Connect to ESP32-C6 device
- [x] Read Lat/Long and Speed BLE characteristics
- [x] BLE data feeds Dashboard (overrides GPS in BLE mode)

## State Management
- [x] AppModeContext (standalone / ble)
- [x] LocationContext (lat, lon, speed)
- [x] BLEContext (scan, connect, data)
- [x] NavigationContext (route, ETA, distance)

## Android Configuration
- [x] INTERNET permission
- [x] ACCESS_FINE_LOCATION permission
- [x] BLUETOOTH_SCAN permission
- [x] BLUETOOTH_CONNECT permission
- [x] android:usesCleartextTraffic="true"
- [x] Screen wakelock (expo-keep-awake)

## Branding
- [x] Generate moped dashboard logo
- [x] Update app name to "Smart Babeta"
- [x] Update all icon assets


## Bug Fixes (Complete)
- [x] Fix route disappearing on GPS location updates (persistent state)
- [x] Increase auto-follow pause timer from 5s to 10s
- [x] Implement isUserInteracting flag for gesture tracking
- [x] Add smooth camera transitions with AnimationController
- [x] Verify route persists across location updates


## Critical Fixes (Complete)
- [x] Memoize MapView to prevent WebView re-renders on location updates
- [x] Add runtime permission handling for BLE (Android 12+)
- [x] Implement BLE adapter state check before scan
- [x] Fix timer race conditions with proper cleanup
- [x] Verify AndroidManifest.xml permissions
