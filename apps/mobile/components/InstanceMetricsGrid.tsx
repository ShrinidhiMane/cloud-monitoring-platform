import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MonitoringMetrics } from "@/services/apiClient";

interface InstanceMetricsGridProps {
  metrics: MonitoringMetrics;
  compact?: boolean;
}

const METRIC_ITEMS: {
  key: keyof MonitoringMetrics;
  label: string;
  formatter: (value: number) => string;
}[] = [
  {
    key: "cpuUtilization",
    label: "CPU",
    formatter: (value) => `${value.toFixed(1)}%`,
  },
  {
    key: "memoryUtilization",
    label: "Memory",
    formatter: (value) => `${value.toFixed(1)}%`,
  },
  {
    key: "networkInBytes",
    label: "Net In",
    formatter: formatBytes,
  },
  {
    key: "networkOutBytes",
    label: "Net Out",
    formatter: formatBytes,
  },
  {
    key: "diskReadOps",
    label: "Disk Read",
    formatter: formatOps,
  },
  {
    key: "diskWriteOps",
    label: "Disk Write",
    formatter: formatOps,
  },
];

export function InstanceMetricsGrid({
  metrics,
  compact = false,
}: InstanceMetricsGridProps) {
  return (
    <View style={styles.grid}>
      {METRIC_ITEMS.map((item) => (
        <View
          key={item.key}
          style={[styles.metricCard, compact && styles.metricCardCompact]}
        >
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text
            style={[styles.metricValue, compact && styles.metricValueCompact]}
          >
            {item.formatter(metrics[item.key])}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  const digits = nextValue >= 100 || unitIndex === 0 ? 0 : 1;
  return `${nextValue.toFixed(digits)} ${units[unitIndex]}`;
}

function formatOps(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${Math.round(value)}`;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricCardCompact: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748B",
  },
  metricValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  metricValueCompact: {
    fontSize: 14,
  },
});
