import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { InstanceCard } from "@/components/InstanceCard";
import { cacheMonitoringHistory } from "@/services/metricsHistory";
import type { MonitoringResponse, MonitoringInstance } from "api-client";
import { apiFetch } from "api-client";
import { mockInstances } from "@/data/mockInstances";

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [, setIsError] = useState<boolean>(false);

  useEffect(() => {
    async function loadInstances() {
      try {
        const instancesResponse: MonitoringResponse =
          await apiFetch("/monitoring");
        const liveInstances = instancesResponse.instances ?? [];
        setInstances(liveInstances);
        await Promise.all(
          liveInstances.map((instance) =>
            cacheMonitoringHistory(instance, "1h"),
          ),
        );
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars,no-unused-vars  */
      } catch (error) {
        setIsError(true);
      }
    }
    loadInstances();
  }, []);

  const displayInstances = instances.length ? instances : mockInstances;

  const renderItem = ({
    item,
  }: {
    item: MonitoringInstance | (typeof mockInstances)[number];
  }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/instance/[id]", params: { id: item.id } })
      }
      style={({ pressed }) => [
        styles.cardWrapper,
        pressed && styles.cardPressed,
      ]}
    >
      <InstanceCard instance={item} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Instances</Text>
        <Text style={styles.subtitle}>EC2 name, IDs, state, and type</Text>
      </View>

      <FlatList
        data={displayInstances}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
    marginTop: 6,
    fontSize: 14,
    color: "#475569",
  },
  listContent: {
    paddingHorizontal: 20,
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
