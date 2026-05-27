/**
 * Pomocník pro přepis hlasu pomocí interní služby Speech-to-Text
 *
 * Průvodce implementací frontendu:
 * 1. Zachyťte zvuk pomocí MediaRecorder API
 * 2. Nahrajte zvuk do úložiště (např. S3), abyste získali adresu URL
 * 3. Přepis hovoru s URL
 *
 * Příklad použití:
 * ```tsx
 * // Komponenta frontendu
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 *
 * // Po nahrání zvuku do úložiště
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   jazyk: 'en', // volitelné
 *   prompt: 'Přepis schůzky' // volitelné
 * });
 * ```
 */
import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string; // Adresa URL zvukového souboru (např. S3 URL)
  language?: string; // Volitelné: zadejte kód jazyka (např. „en“, „es“, „zh“)
  prompt?: string; // Volitelné: vlastní výzva k přepisu
};

// Formát segmentu Native Whisper API
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Formát odpovědi Native Whisper API
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse; // Vraťte nativní odpověď Whisper API přímo

export type TranscriptionError = {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "TRANSCRIPTION_FAILED"
    | "UPLOAD_FAILED"
    | "SERVICE_ERROR";
  details?: string;
};

/**
 * Přepis zvuku na text pomocí interní služby Speech-to-Text
 *
 * @param options -  Zvuková data a metadata
 * @returns  Výsledek nebo chyba přepisu
 */
export async function transcribeAudio(
  options: TranscribeOptions,
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    // Krok 1: Ověřte konfiguraci prostředí
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set",
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set",
      };
    }

    // Krok 2: Stáhněte si zvuk z adresy URL
    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      audioBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get("content-type") || "audio/mpeg";

      // Zkontrolujte velikost souboru (limit 16 MB)
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`,
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Krok 3: Vytvořte FormData pro vícedílné nahrání do Whisper API
    const formData = new FormData();

    // Vytvořte objekt blob z vyrovnávací paměti a připojte jej k formuláři
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);

    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    // Přidat výzvu – použijte vlastní výzvu, pokud je k dispozici, jinak generuje na základě jazyka
    const prompt =
      options.prompt ||
      (options.language
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);

    // Krok 4: Zavolejte přepisovací službu
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;

    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`,
      };
    }

    // Krok 5: Analyzujte a vraťte výsledek přepisu
    const whisperResponse = (await response.json()) as WhisperResponse;

    // Ověřte strukturu odpovědi
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format",
      };
    }

    return whisperResponse; // Vraťte nativní odpověď Whisper API přímo
  } catch (error) {
    // Řešit neočekávané chyby
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Pomocná funkce pro získání přípony souboru z typu MIME
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };

  return mimeToExt[mimeType] || "audio";
}

/**
 * Pomocná funkce pro získání úplného názvu jazyka z kódu ISO
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    pl: "Polish",
    tr: "Turkish",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
  };

  return langMap[langCode] || langCode;
}

/**
 * Příklad implementace procedury tRPC:
 *
 * ```ts
 * // V server/routers.ts
 * import { transcribeAudio } from "./_core/voiceTranscription";
 *
 * export const voiceRouter = router({
 *   přepis: protectedProcedure
 *     .input(z.object({
 *       audioUrl: z.string(),
 *       jazyk: z.string().nepovinné(),
 *       výzva: z.string().nepovinné(),
 *     }))
 *     .mutation(async ({ input, ctx }) => {
 *       const result = await transcribeAudio(input);
 *
 *       Error 500 (Server Error)!!1500.That’s an error.There was an error. Please try again later.That’s all we know.
 *       if (výsledek 'chyba') {
 *         hodit novou TRPCError({
 *           kód: 'BAD_REQUEST',
 *           zpráva: result.error,
 *           příčina: výsledek,
 *         });
 *       }
 *
 *       // Volitelně uložit přepis do databáze
 *       await db.insert(transcriptions).values({
 *         userId: ctx.user.id,
 *         text: vysledek.text,
 *         trvání: result.duration,
 *         jazyk: result.language,
 *         audioUrl: input.audioUrl,
 *         createdAt: new Date(),
 *       });
 *
 *       return result;
 *     }),
 * });
 * ```
 */
