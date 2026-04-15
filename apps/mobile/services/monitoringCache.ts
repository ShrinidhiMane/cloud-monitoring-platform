import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type {
  MonitoringInstance,
  MonitoringMetricPoint,
  MonitoringResponse,
} from "api-client";

const CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const OVERVIEW_FILE_SUFFIX = "overview";

interface CachedOverviewRecord {
  cachedAt: string;
  response: MonitoringResponse;
}

interface CachedInstanceRecord {
  cachedAt: string;
  range: string;
  monitoring: MonitoringInstance;
}

const memoryOverviewCache = new Map<string, CachedOverviewRecord>();
const memoryInstanceCache = new Map<string, CachedInstanceRecord>();

function formatMetricLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function roundMetricValue(value?: number): number {
  return Number((value ?? 0).toFixed(2));
}

function buildFallbackMetricSeries(
  value: number | undefined,
  timestamp: string,
  existingSeries: MonitoringMetricPoint[],
): MonitoringMetricPoint[] {
  if (
    existingSeries.length > 0 ||
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return existingSeries;
  }

  return [
    {
      timestamp,
      label: formatMetricLabel(timestamp),
      value: roundMetricValue(value),
    },
  ];
}

function normalizeMonitoringInstance(
  monitoring: MonitoringInstance,
  fallbackTimestamp: string,
): MonitoringInstance {
  const updatedAt = sanitizeTimestamp(monitoring.updatedAt) ?? fallbackTimestamp;
  const cpuSeries = buildFallbackMetricSeries(
    monitoring.cpuPercent,
    updatedAt,
    monitoring.cpuSeries ?? [],
  );
  const memorySeries = buildFallbackMetricSeries(
    monitoring.memoryPercent,
    updatedAt,
    monitoring.memorySeries ?? [],
  );
  const networkInSeries = buildFallbackMetricSeries(
    monitoring.networkInBytes,
    updatedAt,
    monitoring.networkInSeries ?? [],
  );
  const networkOutSeries = buildFallbackMetricSeries(
    monitoring.networkOutBytes,
    updatedAt,
    monitoring.networkOutSeries ?? [],
  );

  return {
    ...monitoring,
    updatedAt,
    cpuSeries,
    memorySeries,
    networkInSeries,
    networkOutSeries,
  };
}

function canUseFileCache(): boolean {
  return Platform.OS !== "web";
}

function getCacheDirectory(): Directory | null {
  if (!canUseFileCache()) {
    return null;
  }

  return new Directory(Paths.document, "monitoring-cache");
}

function getOverviewMemoryKey(endpoint: string): string {
  return `overview:${endpoint}`;
}

function getInstanceMemoryKey(
  endpoint: string,
  instanceId: string,
  range: string,
): string {
  return `instance:${endpoint}:${range}:${instanceId}`;
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

function isFresh(timestamp?: string): boolean {
  const normalizedTimestamp = sanitizeTimestamp(timestamp);
  if (!normalizedTimestamp) {
    return false;
  }

  return Date.now() - Date.parse(normalizedTimestamp) <= CACHE_RETENTION_MS;
}

function toCacheFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getOverviewFile(endpoint: string): File | null {
  const cacheDirectory = getCacheDirectory();
  if (!cacheDirectory) {
    return null;
  }

  return new File(
    cacheDirectory,
    `${toCacheFilePart(endpoint)}-${OVERVIEW_FILE_SUFFIX}.json`,
  );
}

function getInstanceFile(
  endpoint: string,
  instanceId: string,
  range: string,
): File | null {
  const cacheDirectory = getCacheDirectory();
  if (!cacheDirectory) {
    return null;
  }

  return new File(
    cacheDirectory,
    `${toCacheFilePart(endpoint)}-${toCacheFilePart(range)}-${toCacheFilePart(instanceId)}.json`,
  );
}

function ensureCacheDirectory(): void {
  const cacheDirectory = getCacheDirectory();
  if (!cacheDirectory) {
    return;
  }
  if (!cacheDirectory.exists) {
    cacheDirectory.create({ idempotent: true, intermediates: true });
  }
}

function normalizeOverviewRecord(
  record: CachedOverviewRecord | null,
): CachedOverviewRecord | null {
  if (
    !record ||
    !record.response ||
    !Array.isArray(record.response.instances)
  ) {
    return null;
  }

  const cachedAt =
    sanitizeTimestamp(record.cachedAt) ??
    sanitizeTimestamp(record.response.timestamp);
  if (!cachedAt || !isFresh(cachedAt)) {
    return null;
  }

  return {
    cachedAt,
    response: {
      ...record.response,
      timestamp: sanitizeTimestamp(record.response.timestamp) ?? cachedAt,
      region: record.response.region ?? "",
      instances: record.response.instances.map((instance) =>
        normalizeMonitoringInstance(instance, cachedAt),
      ),
    },
  };
}

function normalizeInstanceRecord(
  record: CachedInstanceRecord | null,
): CachedInstanceRecord | null {
  if (!record || !record.monitoring || !record.range) {
    return null;
  }

  const cachedAt =
    sanitizeTimestamp(record.cachedAt) ??
    sanitizeTimestamp(record.monitoring.updatedAt);
  if (!cachedAt || !isFresh(cachedAt)) {
    return null;
  }

  return {
    cachedAt,
    range: record.range,
    monitoring: normalizeMonitoringInstance(record.monitoring, cachedAt),
  };
}

async function readJsonFile<T>(file: File | null): Promise<T | null> {
  if (!file || !file.exists) {
    return null;
  }

  try {
    const raw = await file.text();
    if (!raw.trim()) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(file: File | null, value: unknown): void {
  if (!file) {
    return;
  }

  try {
    ensureCacheDirectory();
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }

    file.write(JSON.stringify(value));
  } catch {
    // Keep the in-memory cache even if the device file write fails.
  }
}

export async function readCachedMonitoringOverview(
  endpoint: string,
): Promise<CachedOverviewRecord | null> {
  const memoryKey = getOverviewMemoryKey(endpoint);
  const memoryRecord = normalizeOverviewRecord(
    memoryOverviewCache.get(memoryKey) ?? null,
  );
  if (memoryRecord) {
    return memoryRecord;
  }

  const fileRecord = normalizeOverviewRecord(
    await readJsonFile<CachedOverviewRecord>(getOverviewFile(endpoint)),
  );
  if (!fileRecord) {
    memoryOverviewCache.delete(memoryKey);
    return null;
  }

  memoryOverviewCache.set(memoryKey, fileRecord);
  return fileRecord;
}

export async function cacheMonitoringOverview(
  endpoint: string,
  response: MonitoringResponse,
): Promise<CachedOverviewRecord> {
  const record: CachedOverviewRecord = {
    cachedAt: new Date().toISOString(),
    response,
  };
  const normalizedRecord = normalizeOverviewRecord(record);
  if (!normalizedRecord) {
    return record;
  }

  const memoryKey = getOverviewMemoryKey(endpoint);
  memoryOverviewCache.set(memoryKey, normalizedRecord);
  writeJsonFile(getOverviewFile(endpoint), normalizedRecord);
  return normalizedRecord;
}

export async function readCachedMonitoringInstance(
  endpoint: string,
  instanceId: string,
  range: string,
): Promise<CachedInstanceRecord | null> {
  const memoryKey = getInstanceMemoryKey(endpoint, instanceId, range);
  const memoryRecord = normalizeInstanceRecord(
    memoryInstanceCache.get(memoryKey) ?? null,
  );
  if (memoryRecord) {
    return memoryRecord;
  }

  const fileRecord = normalizeInstanceRecord(
    await readJsonFile<CachedInstanceRecord>(
      getInstanceFile(endpoint, instanceId, range),
    ),
  );
  if (!fileRecord) {
    memoryInstanceCache.delete(memoryKey);
    return null;
  }

  memoryInstanceCache.set(memoryKey, fileRecord);
  return fileRecord;
}

export async function cacheMonitoringInstance(
  endpoint: string,
  monitoring: MonitoringInstance,
  range: string,
): Promise<CachedInstanceRecord> {
  const record: CachedInstanceRecord = {
    cachedAt: new Date().toISOString(),
    range,
    monitoring,
  };
  const normalizedRecord = normalizeInstanceRecord(record);
  if (!normalizedRecord) {
    return record;
  }

  const memoryKey = getInstanceMemoryKey(endpoint, monitoring.id, range);
  memoryInstanceCache.set(memoryKey, normalizedRecord);
  writeJsonFile(
    getInstanceFile(endpoint, monitoring.id, range),
    normalizedRecord,
  );
  return normalizedRecord;
}

export async function readCachedOverviewInstance(
  endpoint: string,
  instanceId: string,
): Promise<MonitoringInstance | null> {
  const overviewRecord = await readCachedMonitoringOverview(endpoint);
  if (!overviewRecord) {
    return null;
  }

  return (
    overviewRecord.response.instances.find(
      (instance) => instance.id === instanceId,
    ) ?? null
  );
}
