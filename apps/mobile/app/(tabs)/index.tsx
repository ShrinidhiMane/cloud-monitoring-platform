import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { InstanceCard } from "@/components/InstanceCard";
import { ScreenStateCard } from "@/components/ScreenStateCard";
import { useAutoRefresh, type RefreshReason } from "@/hooks/use-auto-refresh";
import { buildInstanceDetailRoute, SETTINGS_ROUTE } from "@/navigation/routes";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import {
  cacheMonitoringOverview,
  readCachedMonitoringOverview,
} from "@/services/monitoringCache";
import { warmMonitoringHistory } from "@/services/metricsHistory";
import type { MonitoringResponse, MonitoringInstance } from "api-client";
import { fetchMonitoringOverview } from "api-client";

const POLL_INTERVAL_MS = 30_000;
const STATUS_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function ItemSeparator() {
  return <View style={styles.separator} />;
}

function formatStatusTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return "Waiting for the first successful refresh";
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "Waiting for the first successful refresh";
  }

  return STATUS_TIMESTAMP_FORMATTER.format(parsedTimestamp);
}

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [activeApiBaseUrl, setActiveApiBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Loading live monitoring data...",
  );
  const hasInstancesRef = useRef(false);
  const activeApiBaseUrlRef = useRef("");
  const hasLoadedLiveOverviewRef = useRef(false);

  useEffect(() => {
    hasInstancesRef.current = instances.length > 0;
  }, [instances.length]);

  useEffect(() => {
    activeApiBaseUrlRef.current = activeApiBaseUrl;
  }, [activeApiBaseUrl]);

  const loadCachedOverview = useCallback(async (apiBaseUrl: string) => {
    const cachedOverview = await readCachedMonitoringOverview(apiBaseUrl);
    if (!cachedOverview) {
      return false;
    }

    setInstances(cachedOverview.response.instances);
    setLastUpdatedAt(
      cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
    );
    setIsUsingCachedData(true);
    setIsLoading(false);
    setStatusMessage(
      cachedOverview.response.instances.length
        ? `Showing saved metrics from ${apiBaseUrl} while live data reconnects.`
        : `Showing the last saved response from ${apiBaseUrl} while live data reconnects.`,
    );

    return true;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateFromCache = async () => {
      const apiBaseUrl = await hydrateApiBaseUrl();
      if (!isMounted) {
        return;
      }

      setActiveApiBaseUrl(apiBaseUrl);
      const cachedOverview = await readCachedMonitoringOverview(apiBaseUrl);
      if (!isMounted || !cachedOverview || hasLoadedLiveOverviewRef.current) {
        return;
      }

      setInstances(cachedOverview.response.instances);
      setLastUpdatedAt(
        cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
      );
      setIsUsingCachedData(true);
      setIsLoading(false);
      setStatusMessage(
        cachedOverview.response.instances.length
          ? `Showing saved metrics from ${apiBaseUrl} while live data reconnects.`
          : `Showing the last saved response from ${apiBaseUrl} while live data reconnects.`,
      );
    };

    void hydrateFromCache();

    return () => {
      isMounted = false;
    };
  }, [loadCachedOverview]);

  const loadInstances = useCallback(
    async (reason: RefreshReason) => {
      const apiBaseUrl = await hydrateApiBaseUrl();
      const hasExistingInstances = hasInstancesRef.current;
      const endpointChanged =
        Boolean(activeApiBaseUrlRef.current) &&
        activeApiBaseUrlRef.current !== apiBaseUrl;
      let loadedCachedOverview = false;

      setActiveApiBaseUrl(apiBaseUrl);
      setErrorMessage(null);
      if (endpointChanged) {
        loadedCachedOverview = await loadCachedOverview(apiBaseUrl);
        if (!loadedCachedOverview) {
          setInstances([]);
          setLastUpdatedAt(null);
          setIsUsingCachedData(false);
        }
      }
      if (hasExistingInstances) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setStatusMessage(
        reason === "auto" && hasExistingInstances
          ? `Auto-refreshing live metrics from ${apiBaseUrl}...`
          : hasExistingInstances
            ? `Refreshing live data from ${apiBaseUrl}...`
            : `Connecting to ${apiBaseUrl}...`,
      );

      try {
        const instancesResponse: MonitoringResponse =
          await fetchMonitoringOverview();
        hasLoadedLiveOverviewRef.current = true;
        const liveInstances = instancesResponse.instances ?? [];
        setInstances(liveInstances);
        setIsUsingCachedData(false);
        setLastUpdatedAt(
          instancesResponse.timestamp ?? new Date().toISOString(),
        );
        setErrorMessage(null);
        await cacheMonitoringOverview(apiBaseUrl, instancesResponse);

        if (liveInstances.length) {
          setStatusMessage(
            `Live data connected to ${apiBaseUrl}. Auto-refresh runs every 30 seconds while this screen is open.`,
          );

          // Warm local history in the background so the detail screen can open fast.
          void Promise.allSettled(
            liveInstances.map((instance) => warmMonitoringHistory(instance)),
          );
        } else {
          setStatusMessage(
            `Connected to ${apiBaseUrl}. The screen will keep checking every 30 seconds, but no running instances were returned.`,
          );
        }
      } catch {
        const nextErrorMessage = `Could not reach ${apiBaseUrl}. Open Settings to update the API URL and try again.`;
        setErrorMessage(nextErrorMessage);
        setStatusMessage(
          hasExistingInstances
            ? loadedCachedOverview || isUsingCachedData
              ? `Could not refresh ${apiBaseUrl}. Showing cached metrics from the device.`
              : `Could not refresh ${apiBaseUrl}. Showing the last successful instance list.`
            : nextErrorMessage,
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isUsingCachedData, loadCachedOverview],
  );
  const { isAutoRefreshing, runRefresh } = useAutoRefresh({
    intervalMs: POLL_INTERVAL_MS,
    onRefresh: loadInstances,
  });

  const handleRetry = useCallback(() => {
    void runRefresh("manual");
  }, [runRefresh]);

  const handleOpenSettings = useCallback(() => {
    router.push(SETTINGS_ROUTE);
  }, [router]);

  const hasInstances = instances.length > 0;
  const shouldShowStatusCard =
    hasInstances || isRefreshing || isAutoRefreshing || lastUpdatedAt !== null;

  const renderItem = ({ item }: { item: MonitoringInstance }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          buildInstanceDetailRoute({
            id: item.id,
            name: item.name,
            state: item.state,
            type: item.type,
            zone: item.zone,
          }),
        )
      }
      style={({ pressed }) => [
        styles.cardWrapper,
        pressed && styles.cardPressed,
      ]}
    >
      <InstanceCard instance={item} />
    </Pressable>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Instances</Text>
      <Text style={styles.subtitle}>EC2 name, IDs, state, and type</Text>
      {shouldShowStatusCard ? (
        <View
          style={[styles.statusCard, errorMessage && styles.statusCardError]}
        >
          <Text
            style={[styles.statusText, errorMessage && styles.statusTextError]}
          >
            {isAutoRefreshing
              ? "Auto-refreshing live data..."
              : isRefreshing
                ? "Refreshing live data..."
                : statusMessage}
          </Text>
          <View style={styles.statusMetaRow}>
            <View style={styles.liveBadge}>
              <View
                style={[
                  styles.liveDot,
                  (isRefreshing || isAutoRefreshing) && styles.liveDotActive,
                  errorMessage && styles.liveDotError,
                ]}
              />
              <Text
                style={[
                  styles.liveBadgeText,
                  errorMessage && styles.liveBadgeTextError,
                ]}
              >
                {isUsingCachedData
                  ? "Using cached data"
                  : "Refreshes every 30s"}
              </Text>
            </View>
            <Text
              style={[
                styles.statusMetaText,
                errorMessage && styles.statusMetaTextError,
              ]}
            >
              Last update: {formatStatusTimestamp(lastUpdatedAt)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <ScreenStateCard
          variant="loading"
          title="Loading instances"
          message={`Connecting to ${activeApiBaseUrl || "the configured monitoring endpoint"} and fetching the latest EC2 status.`}
        />
      );
    }

    if (errorMessage) {
      return (
        <ScreenStateCard
          variant="error"
          title="Couldn’t load instances"
          message={errorMessage}
          actions={[
            { label: "Try Again", onPress: handleRetry, tone: "primary" },
            { label: "Open Settings", onPress: handleOpenSettings },
          ]}
        />
      );
    }

    return (
      <ScreenStateCard
        variant="empty"
        title="No running instances"
        message="The monitoring endpoint responded, but there are no EC2 instances to show right now. This screen will keep checking automatically every 30 seconds."
        actions={[{ label: "Refresh", onPress: handleRetry, tone: "primary" }]}
      />
    );
  };

  return (
    <FlatList
      data={instances}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={[
        styles.listContent,
        !hasInstances && styles.listContentEmpty,
      ]}
      ItemSeparatorComponent={ItemSeparator}
      onRefresh={handleRetry}
      refreshing={hasInstances ? isRefreshing : false}
      showsVerticalScrollIndicator={false}
      style={styles.safeArea}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    color: "#475569",
  },
  statusCard: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusCardError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusText: {
    fontSize: 12,
    color: "#065F46",
  },
  statusTextError: {
    color: "#991B1B",
  },
  statusMetaRow: {
    marginTop: 8,
    gap: 8,
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#10B981",
    opacity: 0.5,
  },
  liveDotActive: {
    opacity: 1,
  },
  liveDotError: {
    backgroundColor: "#DC2626",
    opacity: 1,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  liveBadgeTextError: {
    color: "#991B1B",
  },
  statusMetaText: {
    fontSize: 12,
    color: "#166534",
  },
  statusMetaTextError: {
    color: "#991B1B",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  cardWrapper: {
    borderRadius: 16,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  separator: {
    height: 12,
  },
});
