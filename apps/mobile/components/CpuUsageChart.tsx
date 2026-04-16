import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CpuUsagePoint } from "@/types/metrics";

interface CpuUsageChartProps {
  data: CpuUsagePoint[];
  height?: number;
}

const MAX_CPU = 100;

export function CpuUsageChart({ data, height = 140 }: CpuUsageChartProps) {
  const safeData = data.length ? data : [{ label: "", value: 0 }];
  const maxValue = Math.max(...safeData.map((point) => point.value), 1);
  const normalizedMax = Math.max(maxValue, MAX_CPU);

  return (
    <View>
      <View
        style={[styles.chart, { height }]}
        accessibilityLabel="CPU utilization chart"
      >
        {safeData.map((point, index) => {
          const barHeight = Math.round((point.value / normalizedMax) * height);
          return (
            <View key={`${point.label}-${index}`} style={styles.barSlot}>
              <View style={[styles.bar, { height: barHeight }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{safeData[0].label}</Text>
        <Text style={styles.axisLabel}>
          {safeData[safeData.length - 1].label}
        </Text>
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
});
