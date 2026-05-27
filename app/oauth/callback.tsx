import { ThemedView } from "@/components/themed-view";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    sessionToken?: string;
    user?: string;
  }>();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[OAuth] Callback handler triggered");
      console.log("[OAuth] Params received:", {
        code: params.code,
        state: params.state,
        error: params.error,
        sessionToken: params.sessionToken ? "present" : "missing",
        user: params.user ? "present" : "missing",
      });
      try {
        // Nejprve zkontrolujte sessionToken v parametrech (zpětné volání webového OAuth z přesměrování serveru)
        if (params.sessionToken) {
          console.log("[OAuth] Session token found in params (web callback)");
          await Auth.setSessionToken(params.sessionToken);

          // Dekódujte a uložte informace o uživateli, pokud jsou k dispozici
          if (params.user) {
            try {
              // Použijte atob pro dekódování base64 (funguje na webu i React Native)
              const userJson =
                typeof atob !== "undefined"
                  ? atob(params.user)
                  : Buffer.from(params.user, "base64").toString("utf-8");
              const userData = JSON.parse(userJson);
              const userInfo: Auth.User = {
                id: userData.id,
                openId: userData.openId,
                name: userData.name,
                email: userData.email,
                loginMethod: userData.loginMethod,
                lastSignedIn: new Date(userData.lastSignedIn || Date.now()),
              };
              await Auth.setUserInfo(userInfo);
              console.log("[OAuth] User info stored:", userInfo);
            } catch (err) {
              console.error("[OAuth] Failed to parse user data:", err);
            }
          }

          setStatus("success");
          console.log("[OAuth] Web authentication successful, redirecting to home...");
          setTimeout(() => {
            router.replace("/(tabs)");
          }, 1000);
          return;
        }

        // Získejte URL z parametrů nebo propojení
        let url: string | null = null;

        // Zkuste nejprve získat z parametrů místního vyhledávání (funguje s expo-routerem)
        if (params.code || params.state || params.error) {
          console.log("[OAuth] Found params in route params");
          // Výtah z param
          const urlParams = new URLSearchParams();
          if (params.code) urlParams.set("code", params.code);
          if (params.state) urlParams.set("state", params.state);
          if (params.error) urlParams.set("error", params.error);
          url = `?${urlParams.toString()}`;
          console.log("[OAuth] Constructed URL from params:", url);
        } else {
          console.log("[OAuth] No params found, checking Linking.getInitialURL()...");
          // Záložní: pokuste se získat z Linking
          const initialUrl = await Linking.getInitialURL();
          console.log("[OAuth] Linking.getInitialURL():", initialUrl);
          if (initialUrl) {
            url = initialUrl;
          }
        }

        // Zkontrolujte, zda nedošlo k chybě
        const error =
          params.error || (url ? new URL(url, "http://dummy").searchParams.get("error") : null);
        if (error) {
          console.error("[OAuth] Error parameter found:", error);
          setStatus("error");
          setErrorMessage(error || "OAuth error occurred");
          return;
        }

        // Zkontrolujte kód a stav
        let code: string | null = null;
        let state: string | null = null;
        let sessionToken: string | null = null;

        // Zkuste nejprve získat od params
        if (params.code && params.state) {
          console.log("[OAuth] Using code and state from route params");
          code = params.code;
          state = params.state;
        } else if (url) {
          console.log("[OAuth] Parsing code and state from URL:", url);
          // Analyzujte z adresy URL
          try {
            const urlObj = new URL(url);
            code = urlObj.searchParams.get("code");
            state = urlObj.searchParams.get("state");
            sessionToken = urlObj.searchParams.get("sessionToken");
            console.log("[OAuth] Extracted from URL:", {
              code: code?.substring(0, 20) + "...",
              state: state?.substring(0, 20) + "...",
              sessionToken: sessionToken ? "present" : "missing",
            });
          } catch (e) {
            console.log("[OAuth] Failed to parse as full URL, trying regex:", e);
            // Zkuste analyzovat jako relativní adresu URL s parametry dotazu
            const match = url.match(/[?&](code|state|sessionToken)=([^&]+)/g);
            if (match) {
              match.forEach((param) => {
                const [key, value] = param.substring(1).split("=");
                if (key === "code") code = decodeURIComponent(value);
                if (key === "state") state = decodeURIComponent(value);
                if (key === "sessionToken") sessionToken = decodeURIComponent(value);
              });
              console.log("[OAuth] Extracted from regex:", {
                code: code?.substring(0, 20) + "...",
                state: state?.substring(0, 20) + "...",
                sessionToken: sessionToken ? "present" : "missing",
              });
            }
          }
        }

        console.log("[OAuth] Final extracted values:", {
          hasCode: !!code,
          hasState: !!state,
          hasSessionToken: !!sessionToken,
        });

        // Pokud máme sessionToken přímo z URL, použijte jej
        if (sessionToken) {
          console.log("[OAuth] Session token found in URL, storing...");
          await Auth.setSessionToken(sessionToken);
          console.log("[OAuth] Session token stored successfully");
          // Error 500 (Server Error)!!1500.That’s an error.There was an error. Please try again later.That’s all we know.
          // Není třeba načítat z API
          setStatus("success");
          console.log("[OAuth] Redirecting to home...");
          setTimeout(() => {
            router.replace("/(tabs)");
          }, 1000);
          return;
        }

        // V opačném případě vyměňte kód za token relace
        if (!code || !state) {
          console.error("[OAuth] Missing code or state parameter", {
            hasCode: !!code,
            hasState: !!state,
          });
          setStatus("error");
          setErrorMessage("Missing code or state parameter");
          return;
        }

        // Vyměňte kód za token relace
        console.log("[OAuth] Exchanging code for session token...", {
          code: code.substring(0, 20) + "...",
          state: state.substring(0, 20) + "...",
        });
        const result = await Api.exchangeOAuthCode(code, state);
        console.log("[OAuth] Exchange result:", {
          hasSessionToken: !!result.sessionToken,
          hasUser: !!result.user,
        });

        if (result.sessionToken) {
          console.log("[OAuth] Session token received, storing...");
          // Uložit token relace
          await Auth.setSessionToken(result.sessionToken);
          console.log("[OAuth] Session token stored successfully");

          // Uložte informace o uživateli, pokud jsou k dispozici
          if (result.user) {
            console.log("[OAuth] User data received:", result.user);
            const userInfo: Auth.User = {
              id: result.user.id,
              openId: result.user.openId,
              name: result.user.name,
              email: result.user.email,
              loginMethod: result.user.loginMethod,
              lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
            };
            await Auth.setUserInfo(userInfo);
            console.log("[OAuth] User info stored:", userInfo);
          } else {
            console.log("[OAuth] No user data in result");
          }

          setStatus("success");
          console.log("[OAuth] Authentication successful, redirecting to home...");

          // Přesměrování domů po krátké prodlevě
          setTimeout(() => {
            console.log("[OAuth] Executing redirect...");
            router.replace("/(tabs)");
          }, 1000);
        } else {
          console.error("[OAuth] No session token in result:", result);
          setStatus("error");
          setErrorMessage("No session token received");
        }
      } catch (error) {
        console.error("[OAuth] Callback error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
  }, [params.code, params.state, params.error, params.sessionToken, params.user, router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              Completing authentication...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text className="text-base leading-6 text-center text-foreground">
              Authentication successful!
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              Redirecting...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              Authentication failed
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
