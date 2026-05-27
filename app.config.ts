// Načíst proměnné prostředí se správnou prioritou (systém > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Formát ID balíčku: space.manus.<projekt_název_tečky>.<časové razítko>
// např. „moje aplikace“ vytvořena 2024-01-15 10:30:45 -> „space.manus.my.app.t20240115103045“
// ID balíčku může obsahovat pouze písmena, čísla a tečky
// Android vyžaduje, aby každý segment oddělený tečkami začínal písmenem
const rawBundleId = "space.manus.smart_babetta.t20260305131651";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Nahraďte spojovníky/podtržítka tečkami
    .replace(/[^a-zA-Z0-9.]/g, "") // Odstraňte neplatné znaky
    .replace(/\.+/g, ".") // Sbalit po sobě jdoucí tečky
    .replace(/^\.+|\.+$/g, "") // Ořízněte úvodní/koncové tečky
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android vyžaduje, aby každý segment začínal písmenem
      // Předpona s 'x', pokud segment začíná číslicí
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extrahujte časové razítko z ID balíčku a předponu s „manus“ pro schéma přímých odkazů
// např. "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // Branding aplikace – aktualizujte tyto hodnoty přímo (nepoužívejte env vars)
  appName: "Babetta Tachometr",
  appSlug: "smart_babetta",
  // S3 URL loga aplikace – nastavte tuto adresu na URL vrácenou generátorem_obrázku při vytváření vlastního loga
  // Ponechte prázdné, chcete-li použít výchozí ikonu z aktiv/images/icon.png
  logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663406851639/YpKbnppfarHjY57Q5Km4rx/smart_babeta_icon-jKyW4x27RrYkepVfnXpjnU.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#000000",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "INTERNET",
      "POST_NOTIFICATIONS",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "BLUETOOTH_SCAN",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Umožňuje Babetta Tachometru používat polohu pro navigaci a zobrazení trasy.",
        locationWhenInUsePermission: "Umožňuje Babetta Tachometru používat polohu pro navigaci a zobrazení trasy.",
      },
    ],
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: false,
        modes: ["peripheral", "central"],
        bluetoothAlwaysPermission: "Umožňuje Babetta Tachometru připojit se k palubnímu modulu přes Bluetooth.",
        nativeModule: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Umožňuje $(PRODUCT_NAME) přístup k mikrofonu.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
          usesCleartextTraffic: true,
          // Ujistěte se, že jsou správně deklarována oprávnění Bluetooth
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
