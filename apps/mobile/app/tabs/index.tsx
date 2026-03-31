import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { InstanceCard } from "@/components/InstanceCard";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import { cacheMonitoringHistory } from "@/services/metricsHistory";
import type { MonitoringResponse, MonitoringInstance } from "api-client";
import { fetchMonitoringOverview } from "api-client";
import { mockInstances } from "@/data/mockInstances";

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [isError, setIsError] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Loading live monitoring data...",
  );

  const loadInstances = useCallback(async () => {
    const apiBaseUrl = await hydrateApiBaseUrl();
    setStatusMessage(`Connecting to ${apiBaseUrl}...`);

    try {
      const instancesResponse: MonitoringResponse =
        await fetchMonitoringOverview();
      const liveInstances = instancesResponse.instances ?? [];
      setInstances(liveInstances);
      setIsError(false);

      if (liveInstances.length) {
        setStatusMessage(`Live data connected to ${apiBaseUrl}.`);
      } else {
        setStatusMessage(
          `Connected to ${apiBaseUrl}, but no running instances were returned.`,
        );
      }

      await Promise.all(
        liveInstances.map((instance) => cacheMonitoringHistory(instance, "1h")),
      );
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars,no-unused-vars  */
    } catch (error) {
      setIsError(true);
      setStatusMessage(
        `Could not reach ${apiBaseUrl}. Open Settings to update the API URL. Showing mock data.`,
      );
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

  const displayInstances = instances.length ? instances : mockInstances;

  const renderItem = ({
    item,
  }: {
    item: MonitoringInstance | (typeof mockInstances)[number];
  }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/instance/[id]",
          params: {
            id: item.id,
            name: item.name,
            state: item.state,
            type: item.type,
            zone: item.zone ?? "",
          },
        })
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
      <View style={[styles.statusCard, isError && styles.statusCardError]}>
        <Text style={[styles.statusText, isError && styles.statusTextError]}>
          {statusMessage}
        </Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={displayInstances}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={ItemSeparator}
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
