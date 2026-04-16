import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";

import { InstanceCard } from "@/components/InstanceCard";
import { ScreenStateCard } from "@/components/ScreenStateCard";
import { useAutoRefresh, type RefreshReason } from "@/hooks/use-auto-refresh";
import { buildInstanceDetailRoute, SETTINGS_ROUTE } from "@/navigation/routes";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";
import {
  readFavoriteInstanceIds,
  toggleFavoriteInstance,
} from "@/services/favoriteInstances";
import {
  cacheMonitoringOverview,
  readCachedMonitoringOverview,
} from "@/services/monitoringCache";
import type {
  InstanceState,
  MonitoringInstance,
  MonitoringResponse,
} from "api-client";
import { fetchMonitoringOverview } from "api-client";

const POLL_INTERVAL_MS = 30_000;
const STATUS_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const OTHER_INSTANCE_STATES: InstanceState[] = [
  "pending",
  "stopping",
  "shutting-down",
  "terminated",
  "unknown",
];

type InstanceFilter = "all" | "running" | "stopped" | "other";

const FILTER_OPTIONS: Array<{ label: string; value: InstanceFilter }> = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Stopped", value: "stopped" },
  { label: "Other", value: "other" },
];

const SUMMARY_ITEMS: Array<{
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  tone: "slate" | "green" | "amber" | "gold";
}> = [
  { icon: "server-outline", label: "Total", tone: "slate" },
  { icon: "play-circle-outline", label: "Running", tone: "green" },
  { icon: "pause-circle-outline", label: "Stopped", tone: "amber" },
  { icon: "star-outline", label: "Favorites", tone: "gold" },
];

const SUMMARY_TONES = {
  slate: { background: "#EEF2F7", icon: "#334155" },
  green: { background: "#EAFBF2", icon: "#15803D" },
  amber: { background: "#FFF7E8", icon: "#B45309" },
  gold: { background: "#FFF8DB", icon: "#B7791F" },
} as const;

function ItemSeparator() {
  return <View style={styles.separator} />;
}

function formatStatusTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return "Waiting for the first successful refresh";
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "Waiting for the first successful refresh";
  }

  return STATUS_TIMESTAMP_FORMATTER.format(parsedTimestamp);
}

function matchesStateFilter(
  instance: MonitoringInstance,
  filter: InstanceFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "other") {
    return OTHER_INSTANCE_STATES.includes(instance.state);
  }

  return instance.state === filter;
}

function matchesSearchQuery(
  instance: MonitoringInstance,
  searchQuery: string,
): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    instance.name,
    instance.id,
    instance.type,
    instance.zone ?? "",
    instance.state,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function compareInstances(
  left: MonitoringInstance,
  right: MonitoringInstance,
  favoriteIds: Set<string>,
): number {
  const leftFavoriteScore = favoriteIds.has(left.id) ? 1 : 0;
  const rightFavoriteScore = favoriteIds.has(right.id) ? 1 : 0;

  if (leftFavoriteScore !== rightFavoriteScore) {
    return rightFavoriteScore - leftFavoriteScore;
  }

  return left.name.localeCompare(right.name);
}

export default function InstancesScreen() {
  const router = useRouter();
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeApiBaseUrl, setActiveApiBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<InstanceFilter>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Loading live monitoring data...",
  );
  const hasInstancesRef = useRef(false);
  const activeApiBaseUrlRef = useRef("");
  const hasLoadedLiveOverviewRef = useRef(false);

  useEffect(() => {
    hasInstancesRef.current = instances.length > 0;
  }, [instances.length]);

  useEffect(() => {
    activeApiBaseUrlRef.current = activeApiBaseUrl;
  }, [activeApiBaseUrl]);

  const loadFavoriteIds = useCallback(async () => {
    setFavoriteIds(await readFavoriteInstanceIds());
  }, []);

  useEffect(() => {
    void loadFavoriteIds();
  }, [loadFavoriteIds]);

  const loadCachedOverview = useCallback(async (apiBaseUrl: string) => {
    const cachedOverview = await readCachedMonitoringOverview(apiBaseUrl);
    if (!cachedOverview) {
      return false;
    }

    setInstances(cachedOverview.response.instances);
    setLastUpdatedAt(
      cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
    );
    setIsUsingCachedData(true);
    setIsLoading(false);
    setStatusMessage(
      cachedOverview.response.instances.length
        ? `Showing saved metrics from ${apiBaseUrl} while live data reconnects.`
        : `Showing the last saved response from ${apiBaseUrl} while live data reconnects.`,
    );

    return true;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateFromCache = async () => {
      const apiBaseUrl = await hydrateApiBaseUrl();
      if (!isMounted) {
        return;
      }

      setActiveApiBaseUrl(apiBaseUrl);
      const cachedOverview = await readCachedMonitoringOverview(apiBaseUrl);
      if (!isMounted || !cachedOverview || hasLoadedLiveOverviewRef.current) {
        return;
      }

      setInstances(cachedOverview.response.instances);
      setLastUpdatedAt(
        cachedOverview.response.timestamp ?? cachedOverview.cachedAt,
      );
      setIsUsingCachedData(true);
      setIsLoading(false);
      setStatusMessage(
        cachedOverview.response.instances.length
          ? `Showing saved metrics from ${apiBaseUrl} while live data reconnects.`
          : `Showing the last saved response from ${apiBaseUrl} while live data reconnects.`,
      );
    };

    void hydrateFromCache();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadInstances = useCallback(
    async (reason: RefreshReason) => {
      const apiBaseUrl = await hydrateApiBaseUrl();
      const hasExistingInstances = hasInstancesRef.current;
      const endpointChanged =
        Boolean(activeApiBaseUrlRef.current) &&
        activeApiBaseUrlRef.current !== apiBaseUrl;
      let loadedCachedOverview = false;

      setActiveApiBaseUrl(apiBaseUrl);
      setErrorMessage(null);
      if (endpointChanged) {
        loadedCachedOverview = await loadCachedOverview(apiBaseUrl);
        if (!loadedCachedOverview) {
          setInstances([]);
          setLastUpdatedAt(null);
          setIsUsingCachedData(false);
        }
      }

      if (hasExistingInstances) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setStatusMessage(
        reason === "auto" && hasExistingInstances
          ? `Auto-refreshing live metrics from ${apiBaseUrl}...`
          : hasExistingInstances
            ? `Refreshing live data from ${apiBaseUrl}...`
            : `Connecting to ${apiBaseUrl}...`,
      );

      try {
        const instancesResponse: MonitoringResponse =
          await fetchMonitoringOverview();
        hasLoadedLiveOverviewRef.current = true;
        const liveInstances = instancesResponse.instances ?? [];
        setInstances(liveInstances);
        setIsUsingCachedData(false);
        setLastUpdatedAt(
          instancesResponse.timestamp ?? new Date().toISOString(),
        );
        setErrorMessage(null);
        await cacheMonitoringOverview(apiBaseUrl, instancesResponse);

        if (liveInstances.length) {
          setStatusMessage(
            `Live data connected to ${apiBaseUrl}. Auto-refresh runs every 30 seconds while this screen is open.`,
          );
        } else {
          setStatusMessage(
            `Connected to ${apiBaseUrl}. The screen will keep checking every 30 seconds, but no instances were returned.`,
          );
        }
      } catch {
        const nextErrorMessage = `Could not reach ${apiBaseUrl}. Open Settings to update the API URL and try again.`;
        setErrorMessage(nextErrorMessage);
        setStatusMessage(
          hasExistingInstances
            ? loadedCachedOverview || isUsingCachedData
              ? `Could not refresh ${apiBaseUrl}. Showing cached metrics from the device.`
              : `Could not refresh ${apiBaseUrl}. Showing the last successful instance list.`
            : nextErrorMessage,
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isUsingCachedData, loadCachedOverview],
  );

  const { isAutoRefreshing, runRefresh } = useAutoRefresh({
    intervalMs: POLL_INTERVAL_MS,
    onRefresh: loadInstances,
  });

  useFocusEffect(
    useCallback(() => {
      void loadFavoriteIds();
      void runRefresh("manual");
    }, [loadFavoriteIds, runRefresh]),
  );

  const handleRetry = useCallback(() => {
    void runRefresh("manual");
  }, [runRefresh]);

  const handleOpenSettings = useCallback(() => {
    router.push(SETTINGS_ROUTE);
  }, [router]);

  const handleToggleFavorite = useCallback(async (instanceId: string) => {
    setFavoriteIds(await toggleFavoriteInstance(instanceId));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setStateFilter("all");
    setShowFavoritesOnly(false);
  }, []);

  const favoriteIdSet = new Set(favoriteIds);
  const filteredInstances = [...instances]
    .filter((instance) => {
      if (showFavoritesOnly && !favoriteIdSet.has(instance.id)) {
        return false;
      }

      return (
        matchesStateFilter(instance, stateFilter) &&
        matchesSearchQuery(instance, searchQuery)
      );
    })
    .sort((left, right) => compareInstances(left, right, favoriteIdSet));
  const hasInstances = instances.length > 0;
  const hasFilteredInstances = filteredInstances.length > 0;
  const runningCount = instances.filter(
    (instance) => instance.state === "running",
  ).length;
  const stoppedCount = instances.filter(
    (instance) => instance.state === "stopped",
  ).length;
  const favoriteCount = instances.filter((instance) =>
    favoriteIdSet.has(instance.id),
  ).length;
  const shouldShowStatusCard =
    hasInstances || isRefreshing || isAutoRefreshing || lastUpdatedAt !== null;
  const summaryValues = [instances.length, runningCount, stoppedCount, favoriteCount];

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
      <InstanceCard
        instance={item}
        isFavorite={favoriteIdSet.has(item.id)}
        onToggleFavorite={handleToggleFavorite}
      />
    </Pressable>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>EC2 Fleet</Text>
        <Text style={styles.title}>Instances</Text>
        <Text style={styles.subtitle}>
          Search, filter, and pin the machines you actually care about.
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        {SUMMARY_ITEMS.map((item, index) => {
          const tone = SUMMARY_TONES[item.tone];

          return (
            <View key={item.label} style={styles.summaryTile}>
              <View
                style={[
                  styles.summaryIconWrap,
                  { backgroundColor: tone.background },
                ]}
              >
                <MaterialCommunityIcons
                  color={tone.icon}
                  name={item.icon}
                  size={18}
                />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryValue}>{summaryValues[index]}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.controlsCard}>
        <View style={styles.searchInputWrap}>
          <MaterialCommunityIcons
            color="#64748B"
            name="magnify"
            size={18}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="Search by name, ID, type, zone, or state"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const isSelected = stateFilter === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  setStateFilter(option.value);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setShowFavoritesOnly((current) => !current);
            }}
            style={({ pressed }) => [
              styles.filterChip,
              showFavoritesOnly && styles.favoriteChipSelected,
              pressed && styles.filterChipPressed,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                showFavoritesOnly && styles.favoriteChipTextSelected,
              ]}
            >
              Favorites
            </Text>
          </Pressable>

          {(searchQuery || stateFilter !== "all" || showFavoritesOnly) && (
            <Pressable
              accessibilityRole="button"
              onPress={handleClearFilters}
              style={({ pressed }) => [
                styles.clearChip,
                pressed && styles.filterChipPressed,
              ]}
            >
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.filterSummaryText}>
          Showing {filteredInstances.length} of {instances.length} instances
        </Text>
      </View>

      {shouldShowStatusCard ? (
        <View
          style={[styles.refreshCard, errorMessage && styles.refreshCardError]}
        >
          <Text
            style={[styles.statusText, errorMessage && styles.statusTextError]}
          >
            {isAutoRefreshing
              ? "Auto-refreshing live data..."
              : isRefreshing
                ? "Refreshing live data..."
                : statusMessage}
          </Text>
          <View style={styles.statusMetaRow}>
            <View style={styles.liveBadge}>
              <View
                style={[
                  styles.liveDot,
                  (isRefreshing || isAutoRefreshing) && styles.liveDotActive,
                  errorMessage && styles.liveDotError,
                ]}
              />
              <Text
                style={[
                  styles.liveBadgeText,
                  errorMessage && styles.liveBadgeTextError,
                ]}
              >
                {isUsingCachedData
                  ? "Using cached data"
                  : "Refreshes every 30s"}
              </Text>
            </View>
            <Text
              style={[
                styles.statusMetaText,
                errorMessage && styles.statusMetaTextError,
              ]}
            >
              Last update: {formatStatusTimestamp(lastUpdatedAt)}
            </Text>
          </View>
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
          title="Couldn't load instances"
          message={errorMessage}
          actions={[
            { label: "Try Again", onPress: handleRetry, tone: "primary" },
            { label: "Open Settings", onPress: handleOpenSettings },
          ]}
        />
      );
    }

    if (hasInstances && !hasFilteredInstances) {
      return (
        <ScreenStateCard
          variant="empty"
          title="No matches for these filters"
          message="Try a different search term or clear the current filters to see more EC2 instances."
          actions={[
            {
              label: "Clear Filters",
              onPress: handleClearFilters,
              tone: "primary",
            },
          ]}
        />
      );
    }

    return (
      <ScreenStateCard
        variant="empty"
        title="No instances returned"
        message="The monitoring endpoint responded, but there are no EC2 instances to show right now. This screen will keep checking automatically every 30 seconds."
        actions={[{ label: "Refresh", onPress: handleRetry, tone: "primary" }]}
      />
    );
  };

  return (
    <FlatList
      data={filteredInstances}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={[
        styles.listContent,
        !hasFilteredInstances && styles.listContentEmpty,
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
    backgroundColor: "#F3F6FB",
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2563EB",
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryTile: {
    width: "48%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 104,
    justifyContent: "space-between",
  },
  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    gap: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748B",
  },
  controlsCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },
  searchInputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 14,
    color: "#0F172A",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipSelected: {
    backgroundColor: "#EEF4FF",
    borderColor: "#BFD3FF",
  },
  favoriteChipSelected: {
    backgroundColor: "#FFF8E1",
    borderColor: "#F3D58A",
  },
  filterChipPressed: {
    opacity: 0.88,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  filterChipTextSelected: {
    color: "#1D4ED8",
  },
  favoriteChipTextSelected: {
    color: "#B45309",
  },
  clearChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  clearChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  filterSummaryText: {
    fontSize: 12,
    color: "#64748B",
  },
  refreshCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#F3FBF7",
    borderWidth: 1,
    borderColor: "#C5EFD7",
  },
  refreshCardError: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F8D1D1",
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#166534",
  },
  statusTextError: {
    color: "#991B1B",
  },
  statusMetaRow: {
    marginTop: 8,
    gap: 8,
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#10B981",
    opacity: 0.5,
  },
  liveDotActive: {
    opacity: 1,
  },
  liveDotError: {
    backgroundColor: "#DC2626",
    opacity: 1,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  liveBadgeTextError: {
    color: "#991B1B",
  },
  statusMetaText: {
    fontSize: 12,
    color: "#166534",
  },
  statusMetaTextError: {
    color: "#991B1B",
  },
  listContent: {
    paddingHorizontal: 20,
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
