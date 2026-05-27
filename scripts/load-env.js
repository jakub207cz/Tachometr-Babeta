/**
 * Vlastní zavaděč prostředí, který upřednostňuje systémové proměnné prostředí
 * přes hodnoty souboru .env. Tím je zajištěno, že platformy Manus vkládají proměnné
 * nejsou přepsány zástupnými hodnotami v .env
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");

  lines.forEach((line) => {
    // Přeskočte komentáře a prázdné řádky
    if (!line || line.trim().startsWith("#")) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // Odstraňte uvozovky

      // Nastavit pouze v případě, že již není definován v prostředí
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Mapujte systémové proměnné na veřejné proměnné Expo
const mappings = {
  VITE_APP_ID: "EXPO_PUBLIC_APP_ID",
  VITE_OAUTH_PORTAL_URL: "EXPO_PUBLIC_OAUTH_PORTAL_URL",
  OAUTH_SERVER_URL: "EXPO_PUBLIC_OAUTH_SERVER_URL",
  OWNER_OPEN_ID: "EXPO_PUBLIC_OWNER_OPEN_ID",
  OWNER_NAME: "EXPO_PUBLIC_OWNER_NAME",
};

for (const [systemVar, expoVar] of Object.entries(mappings)) {
  if (process.env[systemVar] && !process.env[expoVar]) {
    process.env[expoVar] = process.env[systemVar];
  }
}
