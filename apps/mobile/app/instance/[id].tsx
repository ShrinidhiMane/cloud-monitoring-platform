import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { CpuUsageChart } from "@/components/CpuUsageChart";
import {
  TimeRangeSelector,
  type TimeRangeOption,
} from "@/components/TimeRangeSelector";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import {
  cacheMonitoringHistorySnapshot,
  readCachedCpuHistorySnapshot,
  type CachedCpuHistorySnapshot,
} from "@/services/metricsHistory";
import {
  fetchInstanceMonitoring,
  type MonitoringInstance,
  type InstanceState,
} from "api-client";

const INSTANCE_STATES: InstanceState[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "shutting-down",
  "terminated",
  "unknown",
];

const STATE_COLORS: Record<InstanceState, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  running: { bg: "#DCFCE7", text: "#166534" },
  stopping: { bg: "#FFE4E6", text: "#9F1239" },
  stopped: { bg: "#E5E7EB", text: "#374151" },
  "shutting-down": { bg: "#FFE4E6", text: "#9F1239" },
  terminated: { bg: "#F3F4F6", text: "#6B7280" },
  unknown: { bg: "#E0F2FE", text: "#075985" },
};
const POLL_INTERVAL_MS = 30_000;
const MAX_CHART_POINTS = 24;
const EMPTY_HISTORY_SNAPSHOT: CachedCpuHistorySnapshot = {
  chartSeries: [],
  average: 0,
  peak: 0,
  sampleCount: 0,
};
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const DETAIL_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface MetricTileProps {
  label: string;
  value: string;
}

function MetricTile({ label, value }: MetricTileProps) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function readRouteParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseInstanceState(value?: string): InstanceState | null {
  if (!value) {
    return null;
  }

  return INSTANCE_STATES.includes(value as InstanceState)
    ? (value as InstanceState)
    : null;
}

function formatPercent(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${Number(value.toFixed(2))}%`;
}

function formatCompactNumber(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unavailable";
  }

  return COMPACT_NUMBER_FORMATTER.format(value);
}

function formatBytes(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unavailable";
  }

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const normalized = value / 1024 ** exponent;

  return `${normalized.toFixed(normalized >= 100 ? 0 : 1)} ${units[exponent]}`;
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return "Unavailable";
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "Unavailable";
  }

  return DETAIL_TIMESTAMP_FORMATTER.format(parsedTimestamp);
}

export default function InstanceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    name?: string | string[];
    state?: string | string[];
    type?: string | string[];
    zone?: string | string[];
  }>();
  const instanceId = readRouteParam(params.id);
  const fallbackName = readRouteParam(params.name);
  const fallbackState = parseInstanceState(readRouteParam(params.state));
  const fallbackType = readRouteParam(params.type);
  const fallbackZone = readRouteParam(params.zone) || undefined;

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("1h");
  const [monitoring, setMonitoring] = useState<MonitoringInstance | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [historySnapshot, setHistorySnapshot] =
    useState<CachedCpuHistorySnapshot>(EMPTY_HISTORY_SNAPSHOT);
  const [apiBaseUrl, setCurrentApiBaseUrl] = useState("");
  const remoteRange = timeRange === "7d" ? "24h" : timeRange;

  const displayName =
    monitoring?.name ?? fallbackName ?? instanceId ?? "Instance";
  const displayId = monitoring?.id ?? instanceId ?? "Unknown instance";
  const displayState = monitoring?.state ?? fallbackState;
  const displayType = monitoring?.type ?? fallbackType;
  const displayZone = monitoring?.zone ?? fallbackZone;
  const displayUpdatedAt =
    monitoring?.updatedAt ?? historySnapshot.latestTimestamp;
  const latestCpuValue =
    monitoring?.cpuPercent ?? historySnapshot.latestCpuPercent;

  useEffect(() => {
    if (!instanceId) {
      setMetricsError("This route is missing an instance id.");
      setMonitoring(null);
      setHistorySnapshot(EMPTY_HISTORY_SNAPSHOT);
      return;
    }

    let isMounted = true;

    const loadCachedHistory = async () => {
      const cachedSnapshot = await readCachedCpuHistorySnapshot(
        instanceId,
        timeRange,
        MAX_CHART_POINTS,
      );
      if (!isMounted) {
        return;
      }

      setHistorySnapshot(cachedSnapshot);
    };

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      let activeApiBaseUrl = "";

      try {
        activeApiBaseUrl = await hydrateApiBaseUrl();
        if (!isMounted) {
          return;
        }

        setCurrentApiBaseUrl(activeApiBaseUrl);
        const result = await fetchInstanceMonitoring(instanceId, remoteRange);
        if (!isMounted) {
          return;
        }

        if (!result) {
          const cachedSnapshot = await readCachedCpuHistorySnapshot(
            instanceId,
            timeRange,
            MAX_CHART_POINTS,
          );
          if (!isMounted) {
            return;
          }

          setMonitoring(null);
          setHistorySnapshot(cachedSnapshot);
          setMetricsError(
            cachedSnapshot.sampleCount
              ? `No live snapshot was returned for ${instanceId}. Showing saved history.`
              : `No live snapshot was returned for ${instanceId}.`,
          );
          return;
        }

        const nextHistorySnapshot = await cacheMonitoringHistorySnapshot(
          result,
          timeRange,
          MAX_CHART_POINTS,
        );
        if (!isMounted) {
          return;
        }

        setMonitoring(result);
        setHistorySnapshot(nextHistorySnapshot);
      } catch {
        const cachedSnapshot = await readCachedCpuHistorySnapshot(
          instanceId,
          timeRange,
          MAX_CHART_POINTS,
        );
        if (!isMounted) {
          return;
        }

        setHistorySnapshot(cachedSnapshot);
        setMetricsError(
          cachedSnapshot.sampleCount
            ? `Could not refresh ${instanceId}. Showing saved history.`
            : `CloudWatch unavailable at ${activeApiBaseUrl || "the configured endpoint"}.`,
        );
      } finally {
        if (isMounted) {
          setIsLoadingMetrics(false);
        }
      }
    };

    void loadCachedHistory();
    void loadMetrics();

    const pollId = setInterval(() => {
      void loadMetrics();
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(pollId);
    };
  }, [instanceId, remoteRange, timeRange]);

  if (!instanceId) {
    return (
      <View style={styles.emptyScreen}>
        <Stack.Screen
          options={{
            title: "Instance Detail",
            headerLeft: () => (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  router.replace("/tabs");
                }}
                style={({ pressed }) => [
                  styles.headerBackButton,
                  pressed && styles.headerBackButtonPressed,
                ]}
              >
                <MaterialIcons
                  color="#0F172A"
                  name="arrow-back-ios-new"
                  size={18}
                />
              </Pressable>
            ),
          }}
        />
        <Text style={styles.title}>Instance unavailable</Text>
        <Text style={styles.subtitle}>
          Open this screen from the live instances list.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: "Instance Detail",
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace("/tabs");
              }}
              style={({ pressed }) => [
                styles.headerBackButton,
                pressed && styles.headerBackButtonPressed,
              ]}
            >
              <MaterialIcons
                color="#0F172A"
                name="arrow-back-ios-new"
                size={18}
              />
            </Pressable>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>{displayId}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>State</Text>
          {displayState ? (
            <View
              style={[
                styles.statePill,
                { backgroundColor: STATE_COLORS[displayState].bg },
              ]}
              accessibilityLabel={`Instance state ${displayState}`}
            >
              <Text
                style={[
                  styles.stateText,
                  { color: STATE_COLORS[displayState].text },
                ]}
              >
                {displayState}
              </Text>
            </View>
          ) : (
            <Text style={styles.summaryValue}>Unavailable</Text>
          )}
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>
            {displayType || "Unavailable"}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Zone</Text>
          <Text style={styles.summaryValue}>
            {displayZone || "Unavailable"}
          </Text>
        </View>
        <View style={styles.summaryRowLast}>
          <Text style={styles.summaryLabel}>Updated</Text>
          <Text style={styles.summaryValue}>
            {formatTimestamp(displayUpdatedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <Text style={styles.sectionTitle}>Live Metrics</Text>
        <View style={styles.metricGrid}>
          <MetricTile label="CPU" value={formatPercent(latestCpuValue)} />
          <MetricTile
            label="Memory"
            value={formatPercent(monitoring?.memoryPercent)}
          />
          <MetricTile
            label="Network In"
            value={formatBytes(monitoring?.networkInBytes)}
          />
          <MetricTile
            label="Network Out"
            value={formatBytes(monitoring?.networkOutBytes)}
          />
          <MetricTile
            label="Disk Read Ops"
            value={formatCompactNumber(monitoring?.diskReadOps)}
          />
          <MetricTile
            label="Disk Write Ops"
            value={formatCompactNumber(monitoring?.diskWriteOps)}
          />
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderText}>
            <Text style={styles.chartTitle}>CPU Utilization</Text>
            <Text style={styles.chartSubtitle}>
              Selected range: {timeRange}
            </Text>
            {historySnapshot.sampleCount > 0 ? (
              <Text style={styles.cacheText}>
                Chart history is being rendered from saved on-device samples.
              </Text>
            ) : null}
            {apiBaseUrl ? (
              <Text style={styles.endpointText}>API: {apiBaseUrl}</Text>
            ) : null}
            {isLoadingMetrics ? (
              <Text style={styles.loadingText}>Loading metrics…</Text>
            ) : null}
            {metricsError ? (
              <Text style={styles.errorText}>{metricsError}</Text>
            ) : null}
          </View>
          <View style={styles.chartStats}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>{historySnapshot.average}%</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Peak</Text>
              <Text style={styles.statValue}>{historySnapshot.peak}%</Text>
            </View>
          </View>
        </View>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <CpuUsageChart data={historySnapshot.chartSeries} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  headerBackButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerBackButtonPressed: {
    opacity: 0.7,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  summaryRowLast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stateText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  metricsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  metricTile: {
    width: "47%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748B",
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  chartHeaderText: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  chartSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },
  loadingText: {
    marginTop: 6,
    fontSize: 12,
    color: "#94A3B8",
  },
  cacheText: {
    marginTop: 6,
    fontSize: 12,
    color: "#0F766E",
  },
  endpointText: {
    marginTop: 6,
    fontSize: 12,
    color: "#475569",
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: "#DC2626",
  },
  chartStats: {
    flexDirection: "row",
    gap: 12,
  },
  statBlock: {
    alignItems: "flex-end",
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#94A3B8",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
});
