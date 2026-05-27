/**
 * Tenký reexport, takže spotřebitelé nepotřebují vědět o interních tématických instalacích.
 * Plná implementace žije v lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  SchemeColors,
  ThemeColors,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/lib/_core/theme";
