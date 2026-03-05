/** @type {const} */
const themeColors = {
  primary:    { light: '#00B8CC', dark: '#00E5FF' },   // Neon Cyan
  accent:     { light: '#E65100', dark: '#FF6D00' },   // Neon Orange
  background: { light: '#F5F5F5', dark: '#000000' },   // OLED Black
  surface:    { light: '#FFFFFF', dark: '#0D0D0D' },   // Dark panels
  foreground: { light: '#11181C', dark: '#ECEDEE' },   // Primary text
  muted:      { light: '#687076', dark: '#6B7280' },   // Secondary text
  border:     { light: '#D1D5DB', dark: '#1C2A35' },   // Subtle dividers
  success:    { light: '#00C853', dark: '#00E676' },   // Connected / OK
  warning:    { light: '#F59E0B', dark: '#FBBF24' },   // Warning
  error:      { light: '#D50000', dark: '#FF1744' },   // Error / disconnected
};

module.exports = { themeColors };
