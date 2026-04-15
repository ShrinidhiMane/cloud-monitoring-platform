import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { CpuUsagePoint, MonitoringInstance } from "api-client";

export type MetricsHistoryRange = "1h" | "6h" | "24h" | "7d";
export type MetricHistoryPoint = CpuUsagePoint;
export type MetricHistoryKey =
  | "cpuPercent"
  | "memoryPercent"
  | "networkInBytes"
  | "networkOutBytes";

interface StoredMetricSample {
  timestamp: string;
  cpuPercent: number;
  memoryPercent?: number;
  networkInBytes?: number;
  networkOutBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
}

interface NormalizedMetricSample extends StoredMetricSample {
  timestampMs: number;
}

export interface CachedMetricHistorySnapshot {
  chartSeries: MetricHistoryPoint[];
  average: number;
  peak: number;
  sampleCount: number;
  latestTimestamp?: string;
  latestValue?: number;
}

export interface CachedMetricsHistorySnapshot {
  cpu: CachedMetricHistorySnapshot;
  memory: CachedMetricHistorySnapshot;
  networkIn: CachedMetricHistorySnapshot;
  networkOut: CachedMetricHistorySnapshot;
}

export type CachedCpuHistorySnapshot = CachedMetricHistorySnapshot;

const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_POINTS_PER_INSTANCE = 2016;
const DEFAULT_MAX_CHART_POINTS = 24;
const HISTORY_WRITE_DEBOUNCE_MS = 250;
const RANGE_TO_MS: Record<MetricsHistoryRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};
const CPU_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});
const EMPTY_METRIC_HISTORY_SNAPSHOT: CachedMetricHistorySnapshot = {
  chartSeries: [],
  average: 0,
  peak: 0,
  sampleCount: 0,
};

const memoryHistoryStore = new Map<string, NormalizedMetricSample[]>();
const pendingWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

function roundMetricValue(value: number): number {
  return Number(value.toFixed(2));
}

function formatMetricLabel(timestamp: string): string {
  return CPU_LABEL_FORMATTER.format(new Date(timestamp));
}

function normalizeRequiredNumber(
  value: number | undefined,
  fallback = 0,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function normalizeOptionalNumber(
  value: number | undefined,
  fallback?: number,
): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function normalizeSamples(
  samples: readonly StoredMetricSample[],
): NormalizedMetricSample[] {
  const now = Date.now();
  const sampleMap = new Map<string, NormalizedMetricSample>();

  for (const sample of samples) {
    const timestamp = sanitizeTimestamp(sample.timestamp);
    if (!timestamp) {
      continue;
    }

    const timestampMs = Date.parse(timestamp);
    if (now - timestampMs > HISTORY_RETENTION_MS) {
      continue;
    }

    const previous = sampleMap.get(timestamp);
    sampleMap.set(timestamp, {
      timestamp,
      timestampMs,
      cpuPercent: normalizeRequiredNumber(
        sample.cpuPercent,
        previous?.cpuPercent ?? 0,
      ),
      memoryPercent: normalizeOptionalNumber(
        sample.memoryPercent,
        previous?.memoryPercent,
      ),
      networkInBytes: normalizeOptionalNumber(
        sample.networkInBytes,
        previous?.networkInBytes,
      ),
      networkOutBytes: normalizeOptionalNumber(
        sample.networkOutBytes,
        previous?.networkOutBytes,
      ),
      diskReadOps: normalizeOptionalNumber(
        sample.diskReadOps,
        previous?.diskReadOps,
      ),
      diskWriteOps: normalizeOptionalNumber(
        sample.diskWriteOps,
        previous?.diskWriteOps,
      ),
    });
  }

  return [...sampleMap.values()]
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .slice(-MAX_POINTS_PER_INSTANCE);
}

function serializeSamples(
  samples: readonly NormalizedMetricSample[],
): StoredMetricSample[] {
  return samples.map((sample) => ({
    timestamp: sample.timestamp,
    cpuPercent: sample.cpuPercent,
    memoryPercent: sample.memoryPercent,
    networkInBytes: sample.networkInBytes,
    networkOutBytes: sample.networkOutBytes,
    diskReadOps: sample.diskReadOps,
    diskWriteOps: sample.diskWriteOps,
  }));
}

function toCpuUsagePoint(
  sample: NormalizedMetricSample,
  value?: number,
): CpuUsagePoint {
  return {
    timestamp: sample.timestamp,
    label: formatMetricLabel(sample.timestamp),
    value: roundMetricValue(value ?? sample.cpuPercent),
  };
}

function findRangeStartIndex(
  samples: readonly NormalizedMetricSample[],
  cutoff: number,
): number {
  let low = 0;
  let high = samples.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timestampMs < cutoff) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function buildMetricHistorySnapshot(
  samples: readonly NormalizedMetricSample[],
  range: MetricsHistoryRange,
  metricKey: MetricHistoryKey,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): CachedMetricHistorySnapshot {
  if (!samples.length) {
    return EMPTY_METRIC_HISTORY_SNAPSHOT;
  }

  const cutoff = Date.now() - RANGE_TO_MS[range];
  const startIndex = findRangeStartIndex(samples, cutoff);
  if (startIndex >= samples.length) {
    return EMPTY_METRIC_HISTORY_SNAPSHOT;
  }

  const scopedSamples = samples.slice(startIndex);
  const bucketSize = Math.max(1, Math.ceil(scopedSamples.length / maxChartPoints));
  const chartSeries: MetricHistoryPoint[] = [];
  let total = 0;
  let peak = 0;
  let sampleCount = 0;
  let latestSampleWithValue: NormalizedMetricSample | null = null;

  for (
    let bucketStart = 0;
    bucketStart < scopedSamples.length;
    bucketStart += bucketSize
  ) {
    const bucketEnd = Math.min(bucketStart + bucketSize, scopedSamples.length);
    let bucketTotal = 0;
    let bucketCount = 0;
    let bucketLatestSample: NormalizedMetricSample | null = null;

    for (let index = bucketStart; index < bucketEnd; index += 1) {
      const sample = scopedSamples[index];
      const metricValue = sample[metricKey];

      if (typeof metricValue !== "number" || Number.isNaN(metricValue)) {
        continue;
      }

      total += metricValue;
      bucketTotal += metricValue;
      bucketCount += 1;
      sampleCount += 1;
      peak = Math.max(peak, metricValue);
      bucketLatestSample = sample;
      latestSampleWithValue = sample;
    }

    if (bucketCount > 0 && bucketLatestSample) {
      const bucketAverage = bucketTotal / bucketCount;
      chartSeries.push(toCpuUsagePoint(bucketLatestSample, bucketAverage));
    }
  }

  if (!sampleCount || !latestSampleWithValue) {
    return EMPTY_METRIC_HISTORY_SNAPSHOT;
  }

  return {
    chartSeries,
    average: Math.round(total / sampleCount),
    peak: roundMetricValue(peak),
    sampleCount,
    latestTimestamp: latestSampleWithValue.timestamp,
    latestValue: roundMetricValue(latestSampleWithValue[metricKey] ?? 0),
  };
}

function buildMetricsHistorySnapshot(
  samples: readonly NormalizedMetricSample[],
  range: MetricsHistoryRange,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): CachedMetricsHistorySnapshot {
  return {
    cpu: buildMetricHistorySnapshot(samples, range, "cpuPercent", maxChartPoints),
    memory: buildMetricHistorySnapshot(
      samples,
      range,
      "memoryPercent",
      maxChartPoints,
    ),
    networkIn: buildMetricHistorySnapshot(
      samples,
      range,
      "networkInBytes",
      maxChartPoints,
    ),
    networkOut: buildMetricHistorySnapshot(
      samples,
      range,
      "networkOutBytes",
      maxChartPoints,
    ),
  };
}

function buildSamplesFromMonitoring(
  monitoring: MonitoringInstance,
): StoredMetricSample[] {
  const nextSamples: StoredMetricSample[] = [];

  for (const point of monitoring.cpuSeries) {
    const timestamp = sanitizeTimestamp(
      point.timestamp ?? monitoring.updatedAt,
    );
    if (!timestamp) {
      continue;
    }

    nextSamples.push({
      timestamp,
      cpuPercent: point.value,
    });
  }

  const latestTimestamp = sanitizeTimestamp(monitoring.updatedAt);
  if (latestTimestamp) {
    nextSamples.push({
      timestamp: latestTimestamp,
      cpuPercent: monitoring.cpuPercent,
      memoryPercent: monitoring.memoryPercent,
      networkInBytes: monitoring.networkInBytes,
      networkOutBytes: monitoring.networkOutBytes,
      diskReadOps: monitoring.diskReadOps,
      diskWriteOps: monitoring.diskWriteOps,
    });
  }

  return nextSamples;
}

function scheduleStoredSamplesWrite(
  instanceId: string,
  samples: readonly NormalizedMetricSample[],
): void {
  if (!canUseFileHistory()) {
    return;
  }

  const existingTimer = pendingWriteTimers.get(instanceId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const nextTimer = setTimeout(() => {
    pendingWriteTimers.delete(instanceId);

    try {
      const historyDirectory = getHistoryDirectory();
      if (!historyDirectory.exists) {
        historyDirectory.create({ idempotent: true, intermediates: true });
      }

      const historyFile = getHistoryFile(instanceId);
      if (!historyFile.exists) {
        historyFile.create({ intermediates: true, overwrite: true });
      }

      historyFile.write(JSON.stringify(serializeSamples(samples)));
    } catch {
      // Keep the in-memory copy even if the file write fails.
    }
  }, HISTORY_WRITE_DEBOUNCE_MS);

  pendingWriteTimers.set(instanceId, nextTimer);
}

async function readStoredSamples(
  instanceId: string,
): Promise<NormalizedMetricSample[]> {
  if (memoryHistoryStore.has(instanceId)) {
    return memoryHistoryStore.get(instanceId) ?? [];
  }

  if (!canUseFileHistory()) {
    memoryHistoryStore.set(instanceId, []);
    return [];
  }

  try {
    const historyFile = getHistoryFile(instanceId);
    if (!historyFile.exists) {
      memoryHistoryStore.set(instanceId, []);
      return [];
    }

    const raw = await historyFile.text();
    if (!raw.trim()) {
      memoryHistoryStore.set(instanceId, []);
      return [];
    }

    const normalizedSamples = normalizeSamples(
      JSON.parse(raw) as StoredMetricSample[],
    );
    memoryHistoryStore.set(instanceId, normalizedSamples);
    return normalizedSamples;
  } catch {
    memoryHistoryStore.set(instanceId, []);
    return [];
  }
}

async function writeStoredSamples(
  instanceId: string,
  samples: readonly NormalizedMetricSample[],
): Promise<void> {
  const nextSamples = [...samples];
  memoryHistoryStore.set(instanceId, nextSamples);
  scheduleStoredSamplesWrite(instanceId, nextSamples);
}

async function mergeMonitoringHistory(
  monitoring: MonitoringInstance,
): Promise<NormalizedMetricSample[]> {
  const existingSamples = await readStoredSamples(monitoring.id);
  const nextSamples = normalizeSamples([
    ...existingSamples,
    ...buildSamplesFromMonitoring(monitoring),
  ]);

  await writeStoredSamples(monitoring.id, nextSamples);
  return nextSamples;
}

export async function warmMonitoringHistory(
  monitoring: MonitoringInstance,
): Promise<void> {
  await mergeMonitoringHistory(monitoring);
}

export async function readCachedCpuHistory(
  instanceId: string,
  range: MetricsHistoryRange,
): Promise<CpuUsagePoint[]> {
  const snapshot = await readCachedCpuHistorySnapshot(instanceId, range);
  return snapshot.chartSeries;
}

export async function cacheMonitoringHistory(
  monitoring: MonitoringInstance,
  range: MetricsHistoryRange,
): Promise<CpuUsagePoint[]> {
  const snapshot = await cacheMonitoringHistorySnapshot(monitoring, range);
  return snapshot.chartSeries;
}

export async function readCachedCpuHistorySnapshot(
  instanceId: string,
  range: MetricsHistoryRange,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): Promise<CachedCpuHistorySnapshot> {
  const snapshot = await readCachedMetricsHistorySnapshot(
    instanceId,
    range,
    maxChartPoints,
  );
  return snapshot.cpu;
}

export async function readCachedMetricsHistorySnapshot(
  instanceId: string,
  range: MetricsHistoryRange,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): Promise<CachedMetricsHistorySnapshot> {
  const storedSamples = await readStoredSamples(instanceId);
  return buildMetricsHistorySnapshot(storedSamples, range, maxChartPoints);
}

export async function cacheMonitoringHistorySnapshot(
  monitoring: MonitoringInstance,
  range: MetricsHistoryRange,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): Promise<CachedCpuHistorySnapshot> {
  const snapshot = await cacheMonitoringMetricsHistorySnapshot(
    monitoring,
    range,
    maxChartPoints,
  );
  return snapshot.cpu;
}

export async function cacheMonitoringMetricsHistorySnapshot(
  monitoring: MonitoringInstance,
  range: MetricsHistoryRange,
  maxChartPoints = DEFAULT_MAX_CHART_POINTS,
): Promise<CachedMetricsHistorySnapshot> {
  const nextSamples = await mergeMonitoringHistory(monitoring);
  return buildMetricsHistorySnapshot(nextSamples, range, maxChartPoints);
}
