import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { InstanceState, MonitoringInstance } from "api-client";

import { InstanceMetricsGrid } from "@/components/InstanceMetricsGrid";

const STATE_COLORS: Record<InstanceState, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  running: { bg: "#DCFCE7", text: "#166534" },
  stopping: { bg: "#FFE4E6", text: "#9F1239" },
  stopped: { bg: "#E5E7EB", text: "#374151" },
  "shutting-down": { bg: "#FFE4E6", text: "#9F1239" },
  terminated: { bg: "#F3F4F6", text: "#6B7280" },
  unknown: { bg: "#E0F2FE", text: "#075985" },
};

interface InstanceCardProps {
  instance: MonitoringInstance;
  isFavorite?: boolean;
  onToggleFavorite?: (instanceId: string) => void;
}

export function InstanceCard({
  instance,
  isFavorite = false,
  onToggleFavorite,
}: InstanceCardProps) {
  const stateStyle = STATE_COLORS[instance.state];
  const zoneValue = instance.zone?.trim() || "No zone";
  const snapshot = {
    cpuUtilization: instance.cpuPercent,
    memoryUtilization: instance.memoryPercent,
    networkInBytes: instance.networkInBytes,
    networkOutBytes: instance.networkOutBytes,
    diskReadOps: instance.diskReadOps,
    diskWriteOps: instance.diskWriteOps,
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.name}>
            {instance.name}
          </Text>
          <Text numberOfLines={1} style={styles.instanceId}>
            {instance.id}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {onToggleFavorite ? (
            <Pressable
              accessibilityHint={
                isFavorite
                  ? "Removes this instance from favorites"
                  : "Adds this instance to favorites"
              }
              accessibilityLabel={
                isFavorite ? "Remove favorite" : "Add favorite"
              }
              accessibilityRole="button"
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                onToggleFavorite(instance.id);
              }}
              style={({ pressed }) => [
                styles.favoriteButton,
                isFavorite && styles.favoriteButtonActive,
                pressed && styles.favoriteButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                color={isFavorite ? "#D97706" : "#64748B"}
                name={isFavorite ? "star" : "star-outline"}
                size={18}
              />
            </Pressable>
          ) : null}
          <View
            style={[styles.statePill, { backgroundColor: stateStyle.bg }]}
            accessibilityLabel={`Instance state ${instance.state}`}
          >
            <Text style={[styles.stateText, { color: stateStyle.text }]}>
              {instance.state}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaValue}>{instance.type}</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaLabel}>Zone</Text>
          <Text style={styles.metaValue}>{zoneValue}</Text>
        </View>
      </View>

      <View style={styles.metricsSection}>
        <View style={styles.metricsHeader}>
          <Text style={styles.metricsTitle}>Live Snapshot</Text>
          <Text style={styles.metricsCaption}>CPU, memory, network, disk</Text>
        </View>
        <InstanceMetricsGrid metrics={snapshot} compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  instanceId: {
    fontSize: 12,
    color: "#64748B",
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  favoriteButtonActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stateText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaPill: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  metricsSection: {
    marginTop: 14,
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  metricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metricsTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#334155",
  },
  metricsCaption: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
