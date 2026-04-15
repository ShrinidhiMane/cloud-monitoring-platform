import { getApiBaseUrl, getMonitoringUrl } from "./constants";
import type {
  InstancePowerAction,
  InstancePowerResponse,
  InstanceState,
  MonitoringMetricPoint,
  MonitoringInstance,
  MonitoringResponse,
} from "./types";

const KNOWN_INSTANCE_STATES: InstanceState[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "shutting-down",
  "terminated",
  "unknown",
];

function extractErrorMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
    };

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const isAbsoluteUrl = /^https?:\/\//i.test(path);
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const endpoint = isAbsoluteUrl
    ? path
    : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = extractErrorMessage(text);
    throw new Error(message || `HTTP ${res.status}: ${res.statusText}`);
  }

  return (await res.json()) as T;
}

function buildMonitoringUrl(range?: string): string {
  return getMonitoringUrl(range);
}

function buildInstancePowerPath(instanceId: string): string {
  return `/instances/${encodeURIComponent(instanceId)}/power`;
}

interface MonitoringMetricPointResponse {
  timestamp?: string;
  value?: number;
}

interface MonitoringMetricsResponse {
  cpuUtilization?: number;
  memoryUtilization?: number;
  networkInBytes?: number;
  networkOutBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
}

interface MonitoringInstanceResponse {
  id?: string;
  instanceId?: string;
  name?: string;
  state: MonitoringInstance["state"];
  type: string;
  zone?: string;
  cpuPercent?: number;
  memoryPercent?: number;
  networkInBytes?: number;
  networkOutBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
  updatedAt?: string;
  cpuSeries?: MonitoringMetricPointResponse[];
  memorySeries?: MonitoringMetricPointResponse[];
  networkInSeries?: MonitoringMetricPointResponse[];
  networkOutSeries?: MonitoringMetricPointResponse[];
  metrics?: MonitoringMetricsResponse;
}

interface MonitoringApiResponse {
  instances?: MonitoringInstanceResponse[];
  region?: string;
  timestamp?: string;
}

interface InstancePowerApiResponse {
  action?: InstancePowerAction;
  currentState?: string | null;
  instanceId?: string;
  previousState?: string | null;
  requestId?: string | null;
  status?: InstancePowerResponse["status"];
}

const CPU_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function roundMetricValue(value?: number): number {
  return Number((value ?? 0).toFixed(2));
}

function formatMetricLabel(timestamp: string): string {
  return CPU_LABEL_FORMATTER.format(new Date(timestamp));
}

function normalizeMetricSeries(
  points: MonitoringMetricPointResponse[] = [],
): MonitoringMetricPoint[] {
  const normalizedSeries: MonitoringMetricPoint[] = [];

  for (const point of points) {
    if (
      typeof point.timestamp !== "string" ||
      typeof point.value !== "number"
    ) {
      continue;
    }

    normalizedSeries.push({
      timestamp: point.timestamp,
      label: formatMetricLabel(point.timestamp),
      value: roundMetricValue(point.value),
    });
  }

  return normalizedSeries;
}

function getLastSeriesValue(
  points: MonitoringMetricPoint[],
): number | undefined {
  return points[points.length - 1]?.value;
}

function getLatestSeriesTimestamp(
  ...seriesCollection: MonitoringMetricPoint[][]
): string | undefined {
  let latestTimestamp: string | undefined;

  for (const series of seriesCollection) {
    const timestamp = series[series.length - 1]?.timestamp;
    if (!timestamp) {
      continue;
    }

    if (
      !latestTimestamp ||
      Date.parse(timestamp) > Date.parse(latestTimestamp)
    ) {
      latestTimestamp = timestamp;
    }
  }

  return latestTimestamp;
}

function buildFallbackMetricSeries(
  rawValue: number | undefined,
  timestamp: string | undefined,
  existingSeries: MonitoringMetricPoint[],
): MonitoringMetricPoint[] {
  if (
    existingSeries.length > 0 ||
    typeof rawValue !== "number" ||
    Number.isNaN(rawValue) ||
    typeof timestamp !== "string"
  ) {
    return existingSeries;
  }

  return [
    {
      timestamp,
      label: formatMetricLabel(timestamp),
      value: roundMetricValue(rawValue),
    },
  ];
}

function normalizeMonitoringInstance(
  instance: MonitoringInstanceResponse,
): MonitoringInstance {
  const instanceId = instance.id ?? instance.instanceId ?? "unknown-instance";
  const metrics = instance.metrics ?? {};
  const rawCpuValue = instance.cpuPercent ?? metrics.cpuUtilization;
  const rawMemoryValue = instance.memoryPercent ?? metrics.memoryUtilization;
  const rawNetworkInValue = instance.networkInBytes ?? metrics.networkInBytes;
  const rawNetworkOutValue =
    instance.networkOutBytes ?? metrics.networkOutBytes;
  const baseCpuSeries = normalizeMetricSeries(instance.cpuSeries);
  const baseMemorySeries = normalizeMetricSeries(instance.memorySeries);
  const baseNetworkInSeries = normalizeMetricSeries(instance.networkInSeries);
  const baseNetworkOutSeries = normalizeMetricSeries(instance.networkOutSeries);
  const fallbackTimestamp =
    instance.updatedAt ??
    getLatestSeriesTimestamp(
      baseCpuSeries,
      baseMemorySeries,
      baseNetworkInSeries,
      baseNetworkOutSeries,
    ) ??
    new Date().toISOString();
  const cpuSeries = buildFallbackMetricSeries(
    rawCpuValue,
    fallbackTimestamp,
    baseCpuSeries,
  );
  const memorySeries = buildFallbackMetricSeries(
    rawMemoryValue,
    fallbackTimestamp,
    baseMemorySeries,
  );
  const networkInSeries = buildFallbackMetricSeries(
    rawNetworkInValue,
    fallbackTimestamp,
    baseNetworkInSeries,
  );
  const networkOutSeries = buildFallbackMetricSeries(
    rawNetworkOutValue,
    fallbackTimestamp,
    baseNetworkOutSeries,
  );

  return {
    id: instanceId,
    name: instance.name ?? instanceId,
    state: instance.state,
    type: instance.type,
    zone: instance.zone,
    cpuPercent: roundMetricValue(
      rawCpuValue ?? getLastSeriesValue(cpuSeries),
    ),
    memoryPercent: roundMetricValue(
      rawMemoryValue ?? getLastSeriesValue(memorySeries),
    ),
    networkInBytes: roundMetricValue(
      rawNetworkInValue ?? getLastSeriesValue(networkInSeries),
    ),
    networkOutBytes: roundMetricValue(
      rawNetworkOutValue ?? getLastSeriesValue(networkOutSeries),
    ),
    diskReadOps: roundMetricValue(instance.diskReadOps ?? metrics.diskReadOps),
    diskWriteOps: roundMetricValue(
      instance.diskWriteOps ?? metrics.diskWriteOps,
    ),
    cpuSeries,
    memorySeries,
    networkInSeries,
    networkOutSeries,
    updatedAt:
      fallbackTimestamp ??
      getLatestSeriesTimestamp(
        cpuSeries,
        memorySeries,
        networkInSeries,
        networkOutSeries,
      ) ??
      new Date().toISOString(),
  };
}

function normalizeInstanceState(value?: string | null): InstanceState | null {
  if (!value) {
    return null;
  }

  return KNOWN_INSTANCE_STATES.includes(value as InstanceState)
    ? (value as InstanceState)
    : null;
}

export async function fetchMonitoringOverview(
  range?: string,
): Promise<MonitoringResponse> {
  const response = await apiFetch<MonitoringApiResponse>(
    buildMonitoringUrl(range),
  );

  return {
    instances: (response.instances ?? []).map(normalizeMonitoringInstance),
    region: response.region ?? "",
    timestamp: response.timestamp ?? new Date().toISOString(),
  };
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string,
): Promise<MonitoringInstance | null> {
  const response = await fetchMonitoringOverview(range);
  return (
    response.instances.find((instance) => instance.id === instanceId) ?? null
  );
}

export async function controlInstancePower(
  instanceId: string,
  action: InstancePowerAction,
): Promise<InstancePowerResponse> {
  const response = await apiFetch<InstancePowerApiResponse>(
    buildInstancePowerPath(instanceId),
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
  );

  return {
    instanceId: response.instanceId ?? instanceId,
    action: response.action ?? action,
    status: response.status ?? "accepted",
    previousState: normalizeInstanceState(response.previousState),
    currentState: normalizeInstanceState(response.currentState),
    requestId: response.requestId ?? null,
  };
}
