import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { isAlarmActive, type MonitoringAlarm } from "api-client";

interface AlarmFeedCardProps {
  alarm: MonitoringAlarm;
  actionLabel?: string;
  onPress?: () => void;
}

const ALARM_STATE_STYLES: Record<
  string,
  { backgroundColor: string; textColor: string }
> = {
  ALARM: {
    backgroundColor: "#FEF2F2",
    textColor: "#B91C1C",
  },
  INSUFFICIENT_DATA: {
    backgroundColor: "#FFF7ED",
    textColor: "#C2410C",
  },
  OK: {
    backgroundColor: "#ECFDF5",
    textColor: "#15803D",
  },
};

function formatAge(timestamp?: string | null): string {
  if (!timestamp) {
    return "time unavailable";
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.max(Math.round(diffMs / 1000), 0);

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatThreshold(value: number | null): string {
  if (typeof value !== "number") {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getAlarmTarget(alarm: MonitoringAlarm): string {
  return (
    alarm.instanceName ??
    alarm.instanceId ??
    `${alarm.namespace} / ${alarm.metric}`
  );
}

export function AlarmFeedCard({
  alarm,
  actionLabel = "Open Instance",
  onPress,
}: AlarmFeedCardProps) {
  const normalizedState = alarm.state.trim().toUpperCase();
  const palette = ALARM_STATE_STYLES[normalizedState] ?? {
    backgroundColor: "#EFF6FF",
    textColor: "#1D4ED8",
  };
  const supportingText = alarm.stateReason ?? alarm.description;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.alarmName}>{alarm.alarmName}</Text>
          <Text style={styles.alarmTarget}>{getAlarmTarget(alarm)}</Text>
        </View>
        <View
          style={[
            styles.statePill,
            {
              backgroundColor: palette.backgroundColor,
            },
          ]}
        >
          <Text style={[styles.stateText, { color: palette.textColor }]}>
            {alarm.state}
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Metric</Text>
          <Text style={styles.metaValue}>{alarm.metric}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Threshold</Text>
          <Text style={styles.metaValue}>{formatThreshold(alarm.threshold)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Namespace</Text>
          <Text style={styles.metaValue}>{alarm.namespace}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Updated</Text>
          <Text style={styles.metaValue}>{formatAge(alarm.updatedAt)}</Text>
        </View>
      </View>

      {supportingText ? (
        <View style={styles.reasonCard}>
          <MaterialCommunityIcons
            color={isAlarmActive(alarm) ? "#B91C1C" : "#1D4ED8"}
            name={isAlarmActive(alarm) ? "alert-circle-outline" : "information-outline"}
            size={18}
          />
          <Text style={styles.reasonText}>{supportingText}</Text>
        </View>
      ) : null}

      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  alarmTarget: {
    fontSize: 13,
    color: "#64748B",
  },
  statePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stateText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    width: "47%",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#64748B",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  reasonCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
  },
});
