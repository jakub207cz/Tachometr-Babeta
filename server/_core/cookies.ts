import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Základní kontrola IPv4 a detekce přítomnosti IPv6.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Extrahujte nadřazenou doménu pro sdílení souborů cookie napříč subdoménami.
 * např. "3000-xxx.manuspre.computer" -> ".manuspre.computer"
 * To umožňuje, aby soubory cookie nastavené 3000-xxx četl 8081-xxx
 */
function getParentDomain(hostname: string): string | undefined {
  // Nenastavujte doménu pro localhost nebo IP adresy
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Rozdělit název hostitele na části
  const parts = hostname.split(".");

  // Potřebujete alespoň 3 části pro subdoménu (např. „3000-xxx.manuspre.computer“)
  // Pro "manuspre.computer" nemůžeme nastavit nadřazenou doménu
  if (parts.length < 3) {
    return undefined;
  }

  // Vraťte nadřazenou doménu s úvodní tečkou (např. „.manuspre.computer“)
  // To umožňuje sdílení cookie napříč všemi subdoménami
  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
