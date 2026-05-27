/** @type {const} */
const themeColors = {
  primary:    { light: '#00B8CC', dark: '#00E5FF' },   // Neonově azurová
  accent:     { light: '#E65100', dark: '#FF6D00' },   // Neonově oranžová
  background: { light: '#F5F5F5', dark: '#000000' },   // OLED černá
  surface:    { light: '#FFFFFF', dark: '#0D0D0D' },   // Tmavé panely
  foreground: { light: '#11181C', dark: '#ECEDEE' },   // Primární text
  muted:      { light: '#687076', dark: '#6B7280' },   // Sekundární text
  border:     { light: '#D1D5DB', dark: '#1C2A35' },   // Jemné oddělovače
  success:    { light: '#00C853', dark: '#00E676' },   // Připojeno / OK
  warning:    { light: '#F59E0B', dark: '#FBBF24' },   // Varování
  error:      { light: '#D50000', dark: '#FF1744' },   // Chyba / odpojeno
};

module.exports = { themeColors };
