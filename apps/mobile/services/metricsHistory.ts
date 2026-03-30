import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { CpuUsagePoint, MonitoringInstance } from "api-client";

export type MetricsHistoryRange = "1h" | "6h" | "24h" | "7d";

interface StoredMetricSample {
  timestamp: string;
  cpuPercent: number;
  memoryPercent?: number;
  networkInBytes?: number;
  networkOutBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
}

const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_POINTS_PER_INSTANCE = 2016;
const RANGE_TO_MS: Record<MetricsHistoryRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const memoryHistoryStore: Record<string, StoredMetricSample[]> = {};

function canUseFileHistory(): boolean {
  return Platform.OS !== "web";
}

function getHistoryDirectory(): Directory {
  return new Directory(Paths.document, "metrics-history");
}

function getHistoryFile(instanceId: string): File {
  return new File(getHistoryDirectory(), `${instanceId}.json`);
}

function sanitizeTimestamp(timestamp?: string): string | null {
  if (!timestamp) {
    return null;
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return null;
  }

  return parsedTimestamp.toISOString();
}

function formatMetricLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function normalizeSamples(samples: StoredMetricSample[]): StoredMetricSample[] {
  const sampleMap = new Map<string, StoredMetricSample>();

  for (const sample of samples) {
    const timestamp = sanitizeTimestamp(sample.timestamp);
    if (!timestamp) {
      continue;
    }

    const previous = sampleMap.get(timestamp);
    sampleMap.set(timestamp, {
      ...previous,
      ...sample,
      timestamp,
      cpuPercent: Number(sample.cpuPercent ?? previous?.cpuPercent ?? 0),
    });
  }

  return [...sampleMap.values()]
    .sort((left, right) => {
      return (
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
      );
    })
    .filter((sample) => {
      return (
        Date.now() - new Date(sample.timestamp).getTime() <=
        HISTORY_RETENTION_MS
      );
    })
    .slice(-MAX_POINTS_PER_INSTANCE);
}

function toCpuUsagePoints(samples: StoredMetricSample[]): CpuUsagePoint[] {
  return samples.map((sample) => ({
    timestamp: sample.timestamp,
    label: formatMetricLabel(sample.timestamp),
    value: Number(sample.cpuPercent.toFixed(2)),
  }));
}

function filterSamplesByRange(
  samples: StoredMetricSample[],
  range: MetricsHistoryRange,
): StoredMetricSample[] {
  const cutoff = Date.now() - RANGE_TO_MS[range];
  return samples.filter((sample) => {
    return new Date(sample.timestamp).getTime() >= cutoff;
  });
}

function buildSamplesFromMonitoring(
  monitoring: MonitoringInstance,
): StoredMetricSample[] {
  const seriesSamples = monitoring.cpuSeries
    .map((point) => {
      const timestamp = sanitizeTimestamp(
        point.timestamp ?? monitoring.updatedAt,
      );
      if (!timestamp) {
        return null;
      }

      return {
        timestamp,
        cpuPercent: point.value,
      };
    })
    .filter((sample): sample is StoredMetricSample => sample !== null);

  const latestTimestamp = sanitizeTimestamp(monitoring.updatedAt);
  if (!latestTimestamp) {
    return seriesSamples;
  }

  return [
    ...seriesSamples,
    {
      timestamp: latestTimestamp,
      cpuPercent: monitoring.cpuPercent,
      memoryPercent: monitoring.memoryPercent,
      networkInBytes: monitoring.networkInBytes,
      networkOutBytes: monitoring.networkOutBytes,
      diskReadOps: monitoring.diskReadOps,
      diskWriteOps: monitoring.diskWriteOps,
    },
  ];
}

async function readStoredSamples(
  instanceId: string,
): Promise<StoredMetricSample[]> {
  if (!canUseFileHistory()) {
    return normalizeSamples(memoryHistoryStore[instanceId] ?? []);
  }

  try {
    const historyFile = getHistoryFile(instanceId);
    if (!historyFile.exists) {
      return [];
    }

    const raw = await historyFile.text();
    if (!raw.trim()) {
      return [];
    }

    return normalizeSamples(JSON.parse(raw) as StoredMetricSample[]);
  } catch {
    return normalizeSamples(memoryHistoryStore[instanceId] ?? []);
  }
}

async function writeStoredSamples(
  instanceId: string,
  samples: StoredMetricSample[],
): Promise<void> {
  const normalizedSamples = normalizeSamples(samples);
  memoryHistoryStore[instanceId] = normalizedSamples;

  if (!canUseFileHistory()) {
    return;
  }

  try {
    const historyDirectory = getHistoryDirectory();
    if (!historyDirectory.exists) {
      historyDirectory.create({ idempotent: true, intermediates: true });
    }

    const historyFile = getHistoryFile(instanceId);
    if (!historyFile.exists) {
      historyFile.create({ intermediates: true, overwrite: true });
    }

    historyFile.write(JSON.stringify(normalizedSamples));
  } catch {
    // Keep the in-memory copy even if the file write fails.
  }
}

export async function readCachedCpuHistory(
  instanceId: string,
  range: MetricsHistoryRange,
): Promise<CpuUsagePoint[]> {
  const storedSamples = await readStoredSamples(instanceId);
  return toCpuUsagePoints(filterSamplesByRange(storedSamples, range));
}

export async function cacheMonitoringHistory(
  monitoring: MonitoringInstance,
  range: MetricsHistoryRange,
): Promise<CpuUsagePoint[]> {
  const existingSamples = await readStoredSamples(monitoring.id);
  const nextSamples = normalizeSamples([
    ...existingSamples,
    ...buildSamplesFromMonitoring(monitoring),
  ]);

  await writeStoredSamples(monitoring.id, nextSamples);
  return toCpuUsagePoints(filterSamplesByRange(nextSamples, range));
}
