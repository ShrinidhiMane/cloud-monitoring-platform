import { getApiBaseUrl, getMonitoringUrl } from "./constants";
import type {
  CpuUsagePoint,
  MonitoringInstance,
  MonitoringResponse,
} from "./types";

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
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

function buildMonitoringUrl(range?: string): string {
  return getMonitoringUrl(range);
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
  metrics?: MonitoringMetricsResponse;
}

interface MonitoringApiResponse {
  instances?: MonitoringInstanceResponse[];
  region?: string;
  timestamp?: string;
}

function roundMetricValue(value?: number): number {
  return Number((value ?? 0).toFixed(2));
}

function formatMetricLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function normalizeCpuSeries(
  points: MonitoringMetricPointResponse[] = [],
): CpuUsagePoint[] {
  return points
    .filter(
      (
        point,
      ): point is Required<
        Pick<MonitoringMetricPointResponse, "timestamp" | "value">
      > => {
        return (
          typeof point.timestamp === "string" && typeof point.value === "number"
        );
      },
    )
    .map((point) => ({
      timestamp: point.timestamp,
      label: formatMetricLabel(point.timestamp),
      value: roundMetricValue(point.value),
    }));
}

function normalizeMonitoringInstance(
  instance: MonitoringInstanceResponse,
): MonitoringInstance {
  const instanceId = instance.id ?? instance.instanceId ?? "unknown-instance";
  const metrics = instance.metrics ?? {};
  const cpuSeries = normalizeCpuSeries(instance.cpuSeries);

  return {
    id: instanceId,
    name: instance.name ?? instanceId,
    state: instance.state,
    type: instance.type,
    zone: instance.zone,
    cpuPercent: roundMetricValue(instance.cpuPercent ?? metrics.cpuUtilization),
    memoryPercent: roundMetricValue(
      instance.memoryPercent ?? metrics.memoryUtilization,
    ),
    networkInBytes: roundMetricValue(
      instance.networkInBytes ?? metrics.networkInBytes,
    ),
    networkOutBytes: roundMetricValue(
      instance.networkOutBytes ?? metrics.networkOutBytes,
    ),
    diskReadOps: roundMetricValue(instance.diskReadOps ?? metrics.diskReadOps),
    diskWriteOps: roundMetricValue(
      instance.diskWriteOps ?? metrics.diskWriteOps,
    ),
    cpuSeries,
    updatedAt:
      instance.updatedAt ??
      cpuSeries[cpuSeries.length - 1]?.timestamp ??
      new Date().toISOString(),
  };
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
