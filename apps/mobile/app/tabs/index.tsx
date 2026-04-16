import React, { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { InstanceCard } from "@/components/InstanceCard";
import { StatusBanner } from "@/components/StatusBanner";
import { mockInstances } from "@/data/mockInstances";
import { fetchMonitoring, type MonitoringInstance } from "@/services/apiClient";
import { getActiveAwsSetup } from "@/services/awsSetupStorage";

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [activeSetupLabel, setActiveSetupLabel] = useState<string | null>(null);
  const [activeSetupRegion, setActiveSetupRegion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInstances() {
      setIsLoading(true);

      try {
        const response = await fetchMonitoring();
        if (!isMounted) {
          return;
        }

        setInstances(response.instances ?? []);
        setIsUsingMockData(false);
      } catch {
        if (!isMounted) {
          return;
        }

        setInstances(mockInstances);
        setIsUsingMockData(true);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInstances();

    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;

      async function loadSetupStatus() {
        const activeSetup = await getActiveAwsSetup();
        if (!isMounted) {
          return;
        }

        setActiveSetupLabel(activeSetup?.label ?? null);
        setActiveSetupRegion(activeSetup?.region ?? null);
      }

      void loadSetupStatus();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  const renderItem = ({ item }: { item: MonitoringInstance }) => (
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingTitle}>Loading instance monitoring</Text>
        <Text style={styles.loadingSubtitle}>
          Connecting to the live AWS metrics service.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={instances}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Instance Monitoring</Text>
            <Text style={styles.subtitle}>
              {
                "Watch CPU, memory, network, and disk activity for each EC2 instance."
              }
            </Text>
            {activeSetupLabel ? (
              <Text style={styles.setupSummary}>
                Active setup: {activeSetupLabel}
                {activeSetupRegion ? ` · ${activeSetupRegion}` : ""}
              </Text>
            ) : (
              <StatusBanner
                title="AWS setup needed"
                message="Open the Setup tab to save your backend URL, credentials, and default instance details before relying on live monitoring."
              />
            )}
            {isUsingMockData && (
              <StatusBanner
                title="Mock data"
                message={
                  "Live monitoring is unavailable right now, so these instance cards are showing fallback data."
                }
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No running instances found</Text>
            <Text style={styles.emptySubtitle}>
              {
                "The live monitoring service responded successfully but returned no active EC2 instances."
              }
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  loadingSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: "#64748B",
  },
  header: {
    paddingBottom: 16,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  setupSummary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
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
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  separator: {
    height: 14,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
});
