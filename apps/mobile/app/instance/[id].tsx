import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { CpuUsageChart } from "@/components/CpuUsageChart";
import { InstanceMetricsGrid } from "@/components/InstanceMetricsGrid";
import { StatusBanner } from "@/components/StatusBanner";
import {
  TimeRangeSelector,
  type TimeRangeOption,
} from "@/components/TimeRangeSelector";
import { mockCpuSeries } from "@/data/mockCpuSeries";
import { mockInstances } from "@/data/mockInstances";
import {
  fetchInstanceMonitoring,
  type InstanceState,
  type MonitoringInstance,
  type MonitoringMetrics,
} from "@/services/apiClient";

const STATE_COLORS: Record<InstanceState, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  running: { bg: "#DCFCE7", text: "#166534" },
  stopping: { bg: "#FFE4E6", text: "#9F1239" },
  stopped: { bg: "#E5E7EB", text: "#374151" },
  "shutting-down": { bg: "#FFE4E6", text: "#9F1239" },
  terminated: { bg: "#F3F4F6", text: "#6B7280" },
};

const EMPTY_METRICS: MonitoringMetrics = {
  cpuUtilization: 0,
  memoryUtilization: 0,
  networkInBytes: 0,
  networkOutBytes: 0,
  diskReadOps: 0,
  diskWriteOps: 0,
};

const VALID_STATES: InstanceState[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "shutting-down",
  "terminated",
];

export default function InstanceDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    name?: string | string[];
    state?: string | string[];
    type?: string | string[];
  }>();

  const instanceId = getParamValue(params.id);
  const routeName = getParamValue(params.name);
  const routeState = getParamValue(params.state);
  const routeType = getParamValue(params.type);

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("1h");
  const [monitoring, setMonitoring] = useState<MonitoringInstance | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [mockReason, setMockReason] = useState<string | null>(null);

  const fallbackInstance = useMemo(
    () =>
      buildFallbackInstance({
        id: instanceId,
        name: routeName,
        state: routeState,
        type: routeType,
      }),
    [instanceId, routeName, routeState, routeType],
  );

  const displayInstance = monitoring ?? fallbackInstance;
  const stateStyle = STATE_COLORS[displayInstance.state];
  const averageCpu = Math.round(
    mockCpuSeries.reduce((sum, point) => sum + point.value, 0) /
      mockCpuSeries.length,
  );
  const peakCpu = Math.max(...mockCpuSeries.map((point) => point.value));

  useEffect(() => {
    let isMounted = true;

    async function loadInstanceMonitoring() {
      setIsLoadingMetrics(true);
      setMockReason(null);

      if (!instanceId) {
        setMonitoring(fallbackInstance);
        setIsUsingMockData(true);
        setMockReason(
          "Mock data is active because no instance id was provided to load live monitoring.",
        );
        setIsLoadingMetrics(false);
        return;
      }

      try {
        const result = await fetchInstanceMonitoring(instanceId, timeRange);
        if (!isMounted) {
          return;
        }

        if (result) {
          setMonitoring(result);
          setIsUsingMockData(false);
        } else {
          setMonitoring(fallbackInstance);
          setIsUsingMockData(true);
          setMockReason(
            "Mock data is active because this instance was not found in the live monitoring response.",
          );
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setMonitoring(fallbackInstance);
        setIsUsingMockData(true);
        setMockReason(
          "Mock data is active because the live monitoring server could not be reached.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingMetrics(false);
        }
      }
    }

    loadInstanceMonitoring();

    return () => {
      isMounted = false;
    };
  }, [instanceId, fallbackInstance, timeRange]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{displayInstance.name}</Text>
        <Text style={styles.subtitle}>{displayInstance.id}</Text>
      </View>

      {isLoadingMetrics && !monitoring && (
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color="#2563EB" />
          <View style={styles.loadingCopy}>
            <Text style={styles.loadingTitle}>Loading live monitoring</Text>
            <Text style={styles.loadingSubtitle}>
              Trying the real AWS metrics service before showing fallback data.
            </Text>
          </View>
        </View>
      )}

      {isUsingMockData && mockReason && (
        <StatusBanner title="Mock data" message={mockReason} />
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>State</Text>
          <View
            style={[styles.statePill, { backgroundColor: stateStyle.bg }]}
            accessibilityLabel={`Instance state ${displayInstance.state}`}
          >
            <Text style={[styles.stateText, { color: stateStyle.text }]}>
              {displayInstance.state}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>{displayInstance.type}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Source</Text>
          <Text style={styles.summaryValue}>
            {isUsingMockData ? "Mock fallback" : "Live monitoring"}
          </Text>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Metrics Snapshot</Text>
            <Text style={styles.sectionSubtitle}>
              CPU, memory, network, and disk activity for this instance.
            </Text>
          </View>
          {isLoadingMetrics && monitoring && (
            <Text style={styles.refreshingText}>Refreshing…</Text>
          )}
        </View>
        <InstanceMetricsGrid metrics={displayInstance.metrics} />
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>CPU Trend Preview</Text>
            <Text style={styles.sectionSubtitle}>
              Sample chart data until live history endpoints are added.
            </Text>
          </View>
          <View style={styles.chartStats}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>{averageCpu}%</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Peak</Text>
              <Text style={styles.statValue}>{peakCpu}%</Text>
            </View>
          </View>
        </View>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <CpuUsageChart data={mockCpuSeries} />
      </View>
    </ScrollView>
  );
}

function getParamValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildFallbackInstance({
  id,
  name,
  state,
  type,
}: {
  id?: string;
  name?: string;
  state?: string;
  type?: string;
}): MonitoringInstance {
  const matchingMock = mockInstances.find((instance) => instance.id === id);
  if (matchingMock) {
    return matchingMock;
  }

  const fallbackState = VALID_STATES.includes(state as InstanceState)
    ? (state as InstanceState)
    : "running";

  return {
    id: id ?? "unknown-instance",
    name: name?.trim() || id || "Unknown instance",
    state: fallbackState,
    type: type ?? "unknown",
    metrics: EMPTY_METRICS,
  };
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
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  loadingPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 16,
  },
  loadingCopy: {
    flex: 1,
    gap: 4,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  loadingSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#1E40AF",
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
    gap: 14,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  refreshingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
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
    fontWeight: "700",
    color: "#0F172A",
  },
});
