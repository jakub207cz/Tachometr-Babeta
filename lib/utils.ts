import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Kombinuje názvy tříd pomocí clsx a tailwind-merge.
 * To zajišťuje, že třídy Tailwind jsou správně sloučeny bez konfliktů.
 *
 * Používání:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
