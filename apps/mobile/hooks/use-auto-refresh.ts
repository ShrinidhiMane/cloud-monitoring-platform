import { useIsFocused } from "@react-navigation/native";
import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

export type RefreshReason = "focus" | "manual" | "auto";

interface UseAutoRefreshOptions {
  enabled?: boolean;
  intervalMs: number;
  onRefresh: (reason: RefreshReason) => Promise<void> | void;
  refreshKeys?: readonly unknown[];
}

export function useAutoRefresh({
  enabled = true,
  intervalMs,
  onRefresh,
  refreshKeys = [],
}: UseAutoRefreshOptions) {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(false);
  const hasActivatedRef = useRef(false);
  const hasInitializedKeysRef = useRef(false);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      "change",
      setAppState,
    );

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  const runRefresh = useCallback(
    async (reason: RefreshReason = "manual") => {
      if (!enabled || isRefreshingRef.current) {
        return false;
      }

      isRefreshingRef.current = true;
      if (reason === "auto") {
        setIsAutoRefreshing(true);
      }

      try {
        await refreshRef.current(reason);
        return true;
      } finally {
        isRefreshingRef.current = false;
        if (reason === "auto") {
          setIsAutoRefreshing(false);
        }
      }
    },
    [enabled],
  );

  const isActive = enabled && isFocused && appState === "active";

  useEffect(() => {
    if (!isActive) {
      hasActivatedRef.current = false;
      return;
    }

    if (!hasActivatedRef.current) {
      hasActivatedRef.current = true;
      void runRefresh("focus");
    }
  }, [isActive, runRefresh]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = setInterval(() => {
      void runRefresh("auto");
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [intervalMs, isActive, runRefresh]);

  useEffect(() => {
    if (!enabled) {
      hasInitializedKeysRef.current = false;
      return;
    }

    if (!hasInitializedKeysRef.current) {
      hasInitializedKeysRef.current = true;
      return;
    }

    if (isActive) {
      void runRefresh("manual");
    }
  }, [enabled, isActive, runRefresh, ...refreshKeys]);

  return {
    isAutoRefreshing,
    runRefresh,
  };
}
