"use client";

import { useEffect, useRef, useCallback } from "react";

type UsePollingOptions = {
  interval?: number; // Polling interval in milliseconds (default: 30000 = 30 seconds)
  enabled?: boolean; // Whether polling is enabled (default: true)
  onVisibilityChange?: boolean; // Pause polling when tab is not visible (default: true)
};

/**
 * Custom hook for polling data at regular intervals.
 *
 * @param callback - Function to call on each poll
 * @param options - Polling configuration options
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: UsePollingOptions = {}
) {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onVisibilityChange = true,
  } = options;

  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update callback ref on change
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Poll function
  const poll = useCallback(async () => {
    if (callbackRef.current) {
      await callbackRef.current();
    }
  }, []);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling
    intervalRef.current = setInterval(poll, interval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, poll]);

  // Pause polling when tab is not visible
  useEffect(() => {
    if (!onVisibilityChange || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Resume polling
        if (!intervalRef.current) {
          poll(); // Poll immediately on visibility change
          intervalRef.current = setInterval(poll, interval);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onVisibilityChange, enabled, interval, poll]);
}
