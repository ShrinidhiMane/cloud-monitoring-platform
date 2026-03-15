import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { CpuUsageChart } from "@/components/CpuUsageChart";
import {
  TimeRangeSelector,
  type TimeRangeOption,
} from "@/components/TimeRangeSelector";
import { mockCpuSeries } from "@/data/mockCpuSeries";
import { mockInstances } from "@/data/mockInstances";
import {
  fetchInstanceMonitoring,
  type MonitoringInstance,
  InstanceState,
} from "api-client";

const STATE_COLORS: Record<InstanceState, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  running: { bg: "#DCFCE7", text: "#166534" },
  stopping: { bg: "#FFE4E6", text: "#9F1239" },
  stopped: { bg: "#E5E7EB", text: "#374151" },
  "shutting-down": { bg: "#FFE4E6", text: "#9F1239" },
  terminated: { bg: "#F3F4F6", text: "#6B7280" },
};

export default function InstanceDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const instanceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const instance =
    mockInstances.find((item) => item.id === instanceId) ?? mockInstances[0];

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("1h");
  const [monitoring, setMonitoring] = useState<MonitoringInstance | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  const selectedSeries = mockCpuSeries;
  const { average, peak } = useMemo(() => {
    const total = selectedSeries.reduce((sum, point) => sum + point.value, 0);
    return {
      average: Math.round(total / selectedSeries.length),
      peak: Math.max(...selectedSeries.map((point) => point.value)),
    };
  }, [selectedSeries]);
  const displayState: InstanceState = monitoring?.state ?? instance.state;
  const displayType = monitoring?.type ?? instance.type;
  const stateStyle = STATE_COLORS[displayState];

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      try {
        const result = await fetchInstanceMonitoring(instance.id, timeRange);
        if (isMounted) {
          setMonitoring(result);
          setUseMockData(!result);
          if (!result) {
            setMetricsError("CloudWatch unavailable. Showing mock data.");
          }
        }
        /*eslint-disable-next-line @typescript-eslint/no-unused-vars */
      } catch (_) {
        if (isMounted) {
          setMetricsError("CloudWatch unavailable. Showing mock data.");
          setUseMockData(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMetrics(false);
        }
      }
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [instance.id, timeRange]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{instance.name}</Text>
        <Text style={styles.subtitle}>{instance.id}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>State</Text>
          <View
            style={[styles.statePill, { backgroundColor: stateStyle.bg }]}
            accessibilityLabel={`Instance state ${displayState}`}
          >
            <Text style={[styles.stateText, { color: stateStyle.text }]}>
              {displayState}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>{displayType}</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>CPU Utilization</Text>
            <Text style={styles.chartSubtitle}>
              Selected range: {timeRange}
            </Text>
            {monitoring && (
              <Text style={styles.liveMetric}>
                Live CPU: {monitoring.cpuPercent}%
              </Text>
            )}
            {isLoadingMetrics && (
              <Text style={styles.loadingText}>Loading metrics…</Text>
            )}
            {useMockData && !isLoadingMetrics && (
              <Text style={styles.mockText}>Using mock data</Text>
            )}
            {metricsError && !useMockData && (
              <Text style={styles.errorText}>{metricsError}</Text>
            )}
          </View>
          <View style={styles.chartStats}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>{average}%</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Peak</Text>
              <Text style={styles.statValue}>{peak}%</Text>
            </View>
          </View>
        </View>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <CpuUsageChart data={selectedSeries} />
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
  liveMetric: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  loadingText: {
    marginTop: 6,
    fontSize: 12,
    color: "#94A3B8",
  },
  mockText: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
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
