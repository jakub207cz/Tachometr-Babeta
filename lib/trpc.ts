import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * Klient tRPC React pro typově bezpečná volání API.
 *
 * DŮLEŽITÉ (tRPC v11): „Transformátor“ musí být uvnitř „httpBatchLink“,
 * NE na úrovni root createClient. Tím je zajištěn klient i server
 * použijte stejný formát serializace (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Vytvoří klienta tRPC se správnou konfigurací.
 * Zavolejte to jednou v kořenovém rozložení aplikace.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformátor MUSÍ být uvnitř httpBatchLink, ne v rootu
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Vlastní načtení pro zahrnutí přihlašovacích údajů pro ověřování založené na souborech cookie
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
