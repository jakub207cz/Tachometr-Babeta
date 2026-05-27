const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Vynutit zápis CSS do systému souborů namísto virtuálních modulů
  // To opravuje problémy se stylizací iOS ve vývojovém režimu
  forceWriteFileSystem: true,
});
