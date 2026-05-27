import { useRef, useCallback, useEffect } from "react";

/**
 * Bezpečný časovač, který zabraňuje závodním podmínkám
 * Automaticky se čistí při odpojení
 */
export function useSafeTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTimer = useCallback((callback: () => void, delay: number) => {
    // Vymažte všechny existující časovače
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Nastavte nový časovač
    timerRef.current = setTimeout(() => {
      callback();
      timerRef.current = null;
    }, delay);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback((callback: () => void, delay: number) => {
    clearTimer();
    setTimer(callback, delay);
  }, [clearTimer, setTimer]);

  const isActive = useCallback(() => {
    return timerRef.current !== null;
  }, []);

  // Vyčištění při odpojení
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    setTimer,
    clearTimer,
    resetTimer,
    isActive,
  };
}
