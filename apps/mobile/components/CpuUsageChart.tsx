import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CpuUsagePoint } from "api-client";

interface CpuUsageChartProps {
  data: CpuUsagePoint[];
  height?: number;
}

const MAX_CPU = 100;

export function CpuUsageChart({ data, height = 140 }: CpuUsageChartProps) {
  if (!data.length) {
    return (
      <View
        style={[styles.chart, styles.emptyChart, { height }]}
        accessibilityLabel="CPU utilization chart has no data"
      >
        <Text style={styles.emptyText}>No CPU samples yet</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const normalizedMax = Math.max(maxValue, MAX_CPU);

  return (
    <View>
      <View
        style={[styles.chart, { height }]}
        accessibilityLabel="CPU utilization chart"
      >
        {data.map((point, index) => {
          const barHeight = Math.round((point.value / normalizedMax) * height);
          return (
            <View key={`${point.label}-${index}`} style={styles.barSlot}>
              <View style={[styles.bar, { height: barHeight }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{data[0].label}</Text>
        <Text style={styles.axisLabel}>{data[data.length - 1].label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyChart: {
    alignItems: "center",
    justifyContent: "center",
  },
  barSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: 10,
    borderRadius: 999,
    backgroundColor: "#38BDF8",
  },
  axisRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
  },
});
