import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { InstanceMetricsGrid } from "@/components/InstanceMetricsGrid";
import type { InstanceState, MonitoringInstance } from "@/services/apiClient";

const STATE_COLORS: Record<InstanceState, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  running: { bg: "#DCFCE7", text: "#166534" },
  stopping: { bg: "#FFE4E6", text: "#9F1239" },
  stopped: { bg: "#E5E7EB", text: "#374151" },
  "shutting-down": { bg: "#FFE4E6", text: "#9F1239" },
  terminated: { bg: "#F3F4F6", text: "#6B7280" },
};

interface InstanceCardProps {
  instance: MonitoringInstance;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const stateStyle = STATE_COLORS[instance.state];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{instance.name}</Text>
        <View
          style={[styles.statePill, { backgroundColor: stateStyle.bg }]}
          accessibilityLabel={`Instance state ${instance.state}`}
        >
          <Text style={[styles.stateText, { color: stateStyle.text }]}>
            {instance.state}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.label}>ID</Text>
        <Text style={styles.value}>{instance.id}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{instance.type}</Text>
      </View>

      <View style={styles.metricsSection}>
        <Text style={styles.metricsTitle}>Live Snapshot</Text>
        <InstanceMetricsGrid metrics={instance.metrics} compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    flexShrink: 1,
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  metricsSection: {
    marginTop: 14,
    gap: 10,
  },
  metricsTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#334155",
  },
});
