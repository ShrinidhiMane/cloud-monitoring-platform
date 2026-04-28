import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AlarmFeedCard } from "@/components/AlarmFeedCard";
import { ScreenStateCard } from "@/components/ScreenStateCard";
import { useAutoRefresh, type RefreshReason } from "@/hooks/use-auto-refresh";
import { buildInstanceDetailRoute } from "@/navigation/routes";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import {
  cacheMonitoringOverview,
  readCachedMonitoringOverview,
} from "@/services/monitoringCache";
import {
  fetchMonitoringOverview,
  getAlarmInstanceId,
  isAlarmActive,
  sortMonitoringAlarms,
  type MonitoringAlarm,
  type MonitoringResponse,
} from "api-client";

const POLL_INTERVAL_MS = 30_000;

function formatStatusTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return "Waiting for the first successful refresh";
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "Waiting for the first successful refresh";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsedTimestamp);
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default function AlertsScreen() {
  const router = useRouter();
  const [alarms, setAlarms] = useState<MonitoringAlarm[]>([]);
  const [activeApiBaseUrl, setActiveApiBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Loading AWS CloudWatch alarms...",
  );
  const hasLoadedLiveOverviewRef = useRef(false);
  const activeApiBaseUrlRef = useRef("");
  const hasAlarmsRef = useRef(false);

  useEffect(() => {
    activeApiBaseUrlRef.current = activeApiBaseUrl;
  }, [activeApiBaseUrl]);

  useEffect(() => {
    hasAlarmsRef.current = alarms.length > 0;
  }, [alarms.length]);

  const loadCachedOverview = useCallback(async (apiBaseUrl: string) => {
    const cachedOverview = await readCachedMonitoringOverview(apiBaseUrl);
    if (!cachedOverview) {
      return false;
    }

    setAlarms(sortMonitoringAlarms(cachedOverview.response.alarms ?? []));
    setLastUpdatedAt(
      cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
    );
    setIsUsingCachedData(true);
    setIsLoading(false);
    setStatusMessage(
      cachedOverview.response.alarms.length
        ? `Showing saved CloudWatch alarms from ${apiBaseUrl} while live data reconnects.`
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

      setAlarms(sortMonitoringAlarms(cachedOverview.response.alarms ?? []));
      setLastUpdatedAt(
        cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
      );
      setIsUsingCachedData(true);
      setIsLoading(false);
      setStatusMessage(
        cachedOverview.response.alarms.length
          ? `Showing saved CloudWatch alarms from ${apiBaseUrl} while live data reconnects.`
          : `Showing the last saved response from ${apiBaseUrl} while live data reconnects.`,
      );
    };

    void hydrateFromCache();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadAlarms = useCallback(
    async (reason: RefreshReason) => {
      const apiBaseUrl = await hydrateApiBaseUrl();
      const hasExistingAlarms = hasAlarmsRef.current;
      const endpointChanged =
        Boolean(activeApiBaseUrlRef.current) &&
        activeApiBaseUrlRef.current !== apiBaseUrl;
      let loadedCachedOverview = false;

      setActiveApiBaseUrl(apiBaseUrl);
      setErrorMessage(null);
      if (endpointChanged) {
        loadedCachedOverview = await loadCachedOverview(apiBaseUrl);
        if (!loadedCachedOverview) {
          setAlarms([]);
          setLastUpdatedAt(null);
          setIsUsingCachedData(false);
        }
      }

      if (hasExistingAlarms) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setStatusMessage(
        reason === "auto" && hasExistingAlarms
          ? `Auto-refreshing CloudWatch alarms from ${apiBaseUrl}...`
          : hasExistingAlarms
            ? `Refreshing CloudWatch alarms from ${apiBaseUrl}...`
            : `Connecting to ${apiBaseUrl}...`,
      );

      try {
        const response: MonitoringResponse = await fetchMonitoringOverview("1h");
        hasLoadedLiveOverviewRef.current = true;
        const nextAlarms = sortMonitoringAlarms(response.alarms ?? []);

        setAlarms(nextAlarms);
        setIsUsingCachedData(false);
        setLastUpdatedAt(response.timestamp ?? new Date().toISOString());
        setErrorMessage(null);
        await cacheMonitoringOverview(apiBaseUrl, response);

        setStatusMessage(
          nextAlarms.length
            ? `Live CloudWatch alarms connected to ${apiBaseUrl}. Auto-refresh runs every 30 seconds while this screen is open.`
            : `Connected to ${apiBaseUrl}. No CloudWatch alarms were returned yet.`,
        );
      } catch {
        const nextErrorMessage = `Could not reach ${apiBaseUrl}. Open Settings to update the API URL and try again.`;
        setErrorMessage(nextErrorMessage);
        setStatusMessage(
          hasExistingAlarms
            ? loadedCachedOverview || isUsingCachedData
              ? `Could not refresh ${apiBaseUrl}. Showing cached CloudWatch alarms from the device.`
              : `Could not refresh ${apiBaseUrl}. Showing the last successful alarm list.`
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
    onRefresh: loadAlarms,
  });

  const handleRetry = useCallback(() => {
    void runRefresh("manual");
  }, [runRefresh]);

  const handleOpenAlarm = useCallback(
    (alarm: MonitoringAlarm) => {
      if (!alarm.instanceId) {
        return;
      }

      router.push(
        buildInstanceDetailRoute({
          id: alarm.instanceId,
          name: alarm.instanceName ?? undefined,
        }),
      );
    },
    [router],
  );

  const activeAlarms = alarms.filter(isAlarmActive);
  const linkedInstanceCount = new Set(
    activeAlarms
      .map((alarm) => getAlarmInstanceId(alarm))
      .filter((value): value is string => Boolean(value)),
  ).size;
  const statusTone = errorMessage
    ? styles.statusCardError
    : activeAlarms.length
      ? styles.statusCardWarning
      : styles.statusCardHealthy;

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>CloudWatch</Text>
        <Text style={styles.title}>AWS Alerts</Text>
        <Text style={styles.subtitle}>
          Review the live CloudWatch alarm feed for Android, iOS, and Expo web
          from a single screen.
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{activeAlarms.length}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{linkedInstanceCount}</Text>
          <Text style={styles.summaryLabel}>Linked Instances</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{alarms.length}</Text>
          <Text style={styles.summaryLabel}>Total Alarms</Text>
        </View>
      </View>

      <View style={[styles.statusCard, statusTone]}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>
            {activeAlarms.length
              ? `${activeAlarms.length} alarm${activeAlarms.length === 1 ? "" : "s"} need attention`
              : "No active AWS alarms"}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
            ]}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>
        <Text style={styles.statusMessage}>
          {isAutoRefreshing
            ? "Auto-refreshing live alarm data..."
            : isRefreshing
              ? "Refreshing live alarm data..."
              : statusMessage}
        </Text>
        <Text style={styles.statusMeta}>
          Last update: {formatStatusTimestamp(lastUpdatedAt)}
          {isUsingCachedData ? " • using cached data" : " • live refresh every 30s"}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: MonitoringAlarm }) => (
    <AlarmFeedCard
      alarm={item}
      actionLabel={item.instanceId ? "Open Instance" : "Alarm Only"}
      onPress={item.instanceId ? () => handleOpenAlarm(item) : undefined}
    />
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <ScreenStateCard
          variant="loading"
          title="Loading CloudWatch alarms"
          message={`Connecting to ${activeApiBaseUrl || "the configured monitoring endpoint"} and fetching the latest AWS alarm state.`}
        />
      );
    }

    if (errorMessage) {
      return (
        <ScreenStateCard
          variant="error"
          title="Couldn't load AWS alarms"
          message={errorMessage}
          actions={[{ label: "Try Again", onPress: handleRetry, tone: "primary" }]}
        />
      );
    }

    return (
      <ScreenStateCard
        variant="empty"
        title="No CloudWatch alarms returned"
        message="The monitoring endpoint responded, but there are no AWS alarms to show right now. This screen will keep checking automatically every 30 seconds."
        actions={[{ label: "Refresh", onPress: handleRetry, tone: "primary" }]}
      />
    );
  };

  return (
    <FlatList
      data={alarms}
      keyExtractor={(item, index) =>
        `${item.alarmName}-${item.updatedAt ?? "unknown"}-${item.instanceId ?? "resource"}-${index}`
      }
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={[
        styles.listContent,
        !alarms.length && styles.listContentEmpty,
      ]}
      ItemSeparatorComponent={ItemSeparator}
      onRefresh={handleRetry}
      refreshing={alarms.length ? isRefreshing : false}
      showsVerticalScrollIndicator={false}
      style={styles.safeArea}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  listContent: {
    padding: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2563EB",
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 92,
    justifyContent: "space-between",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748B",
  },
  statusCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  statusCardHealthy: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
  },
  statusCardWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  statusCardError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  statusMeta: {
    fontSize: 12,
    color: "#64748B",
  },
  refreshButton: {
    borderRadius: 999,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  refreshButtonPressed: {
    opacity: 0.88,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  separator: {
    height: 12,
  },
});
