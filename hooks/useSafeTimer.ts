import { useRef, useCallback, useEffect } from "react";

/**
 * A safe timer hook that prevents race conditions
 * Automatically cleans up on unmount
 */
export function useSafeTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTimer = useCallback((callback: () => void, delay: number) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Set new timer
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

  // Cleanup on unmount
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
