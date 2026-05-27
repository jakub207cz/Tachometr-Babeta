/**
 * Manus Runtime – Komunikační vrstva mezi webovou aplikací Expo a nadřazeným kontejnerem (next-agent-webapp)
 *
 * Zjednodušený tok:
 * 1. volána initManusRuntime().
 * 2. Odešlete 'appDevServerReady' rodičovi, abyste signalizovali, že je aplikace připravena
 *
 * Uživatel se přihlásí ručně přes přihlašovací stránku aplikace – žádné automatické vkládání souborů cookie.
 */

import { Platform } from "react-native";
import type { Metrics } from "react-native-safe-area-context";

// Ladění protokolování s časovými razítky
const DEBUG = true;
const log = (msg: string) => {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  console.log(`[ManusRuntime ${ts}] ${msg}`);
};

type MessageType = "appDevServerReady";
type SafeAreaInsets = { top: number; right: number; bottom: number; left: number };
type SafeAreaCallback = (metrics: Metrics) => void;

interface SpacePreviewerMessage {
  type: "SpacePreviewerChannel";
  payload: {
    type: string;
    from: "container" | "content";
    to: "container" | "content";
    payload: Record<string, unknown>;
  };
}

function isInIframe(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isWeb(): boolean {
  return Platform.OS === "web";
}

function sendToParent(type: MessageType, payload: Record<string, unknown> = {}): void {
  // NOTE: Pokud potřebujeme přenést citlivá data, ověřte nadřazený původ
  if (!isWeb() || !isInIframe()) return;

  const message: SpacePreviewerMessage = {
    type: "SpacePreviewerChannel",
    payload: { type, from: "content", to: "container", payload },
  };
  window.parent.postMessage(message, "*");
  log(`Sent to parent: ${type}`);
}

let initialized = false;
let safeAreaCallback: SafeAreaCallback | null = null;

function isValidInsets(payload: Record<string, unknown>): payload is SafeAreaInsets {
  return (
    typeof payload.top === "number" &&
    typeof payload.bottom === "number" &&
    typeof payload.left === "number" &&
    typeof payload.right === "number"
  );
}

function handleMessage(event: MessageEvent<unknown>): void {
  // NOTE: Pokud potřebujeme přenést citlivá data, ověřte event.origin
  const data = event.data as SpacePreviewerMessage | undefined;
  if (!data || data.type !== "SpacePreviewerChannel") return;

  const { payload } = data;
  if (!payload || payload.to !== "content") return;

  if (payload.type === "setSafeAreaInsets" && isValidInsets(payload.payload) && safeAreaCallback) {
    const insets = payload.payload;
    const frame = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    safeAreaCallback({ insets, frame });
    log(
      `Received safe area insets from parent: top=${insets.top}, bottom=${insets.bottom}, left=${insets.left}, right=${insets.right}`,
    );
  }
}

/**
 * Přihlaste se k odběru aktualizací bezpečné oblasti z nadřazeného kontejneru.
 */
export function subscribeSafeAreaInsets(callback: SafeAreaCallback): () => void {
  safeAreaCallback = callback;
  return () => {
    if (safeAreaCallback === callback) {
      safeAreaCallback = null;
    }
  };
}

/**
 * Inicializovat Manus Runtime – pouze upozorní rodiče, že aplikace je připravena
 */
export function initManusRuntime(): void {
  if (!isWeb() || !isInIframe()) return;
  if (initialized) return;
  initialized = true;

  log("initManusRuntime called");
  window.addEventListener("message", handleMessage);
  sendToParent("appDevServerReady", {});
}

/**
 * Zkontrolujte, zda běží v náhledu iframe
 */
export function isRunningInPreviewIframe(): boolean {
  return isWeb() && isInIframe();
}
