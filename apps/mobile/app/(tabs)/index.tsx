import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { InstanceCard } from "@/components/InstanceCard";
import { ScreenStateCard } from "@/components/ScreenStateCard";
import { buildInstanceDetailRoute, SETTINGS_ROUTE } from "@/navigation/routes";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import { warmMonitoringHistory } from "@/services/metricsHistory";
import type { MonitoringResponse, MonitoringInstance } from "api-client";
import { fetchMonitoringOverview } from "api-client";

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [activeApiBaseUrl, setActiveApiBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Loading live monitoring data...",
  );
  const hasInstancesRef = useRef(false);

  useEffect(() => {
    hasInstancesRef.current = instances.length > 0;
  }, [instances.length]);

  const loadInstances = useCallback(async () => {
    const apiBaseUrl = await hydrateApiBaseUrl();
    const hasExistingInstances = hasInstancesRef.current;

    setActiveApiBaseUrl(apiBaseUrl);
    setErrorMessage(null);
    if (hasExistingInstances) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setStatusMessage(`Connecting to ${apiBaseUrl}...`);

    try {
      const instancesResponse: MonitoringResponse =
        await fetchMonitoringOverview();
      const liveInstances = instancesResponse.instances ?? [];
      setInstances(liveInstances);
      setErrorMessage(null);

      if (liveInstances.length) {
        setStatusMessage(`Live data connected to ${apiBaseUrl}.`);

        // Warm local history in the background so the detail screen can open fast.
        void Promise.allSettled(
          liveInstances.map((instance) => warmMonitoringHistory(instance)),
        );
      } else {
        setStatusMessage(
          `Connected to ${apiBaseUrl}, but no running instances were returned.`,
        );
      }
    } catch {
      const nextErrorMessage = `Could not reach ${apiBaseUrl}. Open Settings to update the API URL and try again.`;
      setErrorMessage(nextErrorMessage);
      setStatusMessage(
        hasExistingInstances
          ? `Could not refresh ${apiBaseUrl}. Showing the last successful instance list.`
          : nextErrorMessage,
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      try {
        void loadInstances();
      } catch {
        // The async loader handles its own state and errors.
      }
    }, [loadInstances]),
  );

  const handleRetry = useCallback(() => {
    void loadInstances();
  }, [loadInstances]);

  const handleOpenSettings = useCallback(() => {
    router.push(SETTINGS_ROUTE);
  }, [router]);

  const hasInstances = instances.length > 0;

  const renderItem = ({ item }: { item: MonitoringInstance }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          buildInstanceDetailRoute({
            id: item.id,
            name: item.name,
            state: item.state,
            type: item.type,
            zone: item.zone,
          }),
        )
      }
      style={({ pressed }) => [
        styles.cardWrapper,
        pressed && styles.cardPressed,
      ]}
    >
      <InstanceCard instance={item} />
    </Pressable>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Instances</Text>
      <Text style={styles.subtitle}>EC2 name, IDs, state, and type</Text>
      {hasInstances || isRefreshing ? (
        <View
          style={[styles.statusCard, errorMessage && styles.statusCardError]}
        >
          <Text
            style={[styles.statusText, errorMessage && styles.statusTextError]}
          >
            {isRefreshing ? "Refreshing live data..." : statusMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <ScreenStateCard
          variant="loading"
          title="Loading instances"
          message={`Connecting to ${activeApiBaseUrl || "the configured monitoring endpoint"} and fetching the latest EC2 status.`}
        />
      );
    }

    if (errorMessage) {
      return (
        <ScreenStateCard
          variant="error"
          title="Couldn’t load instances"
          message={errorMessage}
          actions={[
            { label: "Try Again", onPress: handleRetry, tone: "primary" },
            { label: "Open Settings", onPress: handleOpenSettings },
          ]}
        />
      );
    }

    return (
      <ScreenStateCard
        variant="empty"
        title="No running instances"
        message="The monitoring endpoint responded, but there are no EC2 instances to show right now."
        actions={[{ label: "Refresh", onPress: handleRetry, tone: "primary" }]}
      />
    );
  };

  return (
    <FlatList
      data={instances}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={[
        styles.listContent,
        !hasInstances && styles.listContentEmpty,
      ]}
      ItemSeparatorComponent={ItemSeparator}
      onRefresh={handleRetry}
      refreshing={hasInstances ? isRefreshing : false}
      showsVerticalScrollIndicator={false}
      style={styles.safeArea}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    color: "#475569",
  },
  statusCard: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusCardError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusText: {
    fontSize: 12,
    color: "#065F46",
  },
  statusTextError: {
    color: "#991B1B",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  cardWrapper: {
    borderRadius: 16,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  separator: {
    height: 12,
  },
});
