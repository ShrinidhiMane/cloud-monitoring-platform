import {
  API_URL,
  apiFetch as baseApiFetch,
  createApiClient,
  getApiBaseUrl,
  setApiBaseUrl,
} from "../../../packages/api-client/src";

import type {
  ApiClient,
  InstanceState,
  MonitoringInstance,
  MonitoringMetrics,
  MonitoringResponse,
  OpenApiPaths,
} from "../../../packages/api-client/src";

export {
  API_URL,
  baseApiFetch as apiFetch,
  createApiClient,
  getApiBaseUrl,
  setApiBaseUrl,
};

export type {
  ApiClient,
  InstanceState,
  MonitoringInstance,
  MonitoringMetrics,
  MonitoringResponse,
  OpenApiPaths,
};

type RawMonitoringMetrics = Partial<MonitoringMetrics>;

type RawMonitoringInstance = {
  id?: string;
  instanceId?: string;
  name?: string;
  state?: string;
  type?: string;
  metrics?: RawMonitoringMetrics;
  cpuPercent?: number;
  memoryUtilization?: number;
  networkInBytes?: number;
  networkOutBytes?: number;
  diskReadOps?: number;
  diskWriteOps?: number;
};

type RawMonitoringResponse = {
  instances?: RawMonitoringInstance[];
  region?: string;
  timestamp?: string;
};

const VALID_STATES: InstanceState[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "shutting-down",
  "terminated",
];

function buildMonitoringUrl(range?: string): string {
  if (!range) {
    return "/monitoring";
  }

  return `/monitoring?range=${encodeURIComponent(range)}`;
}

function normalizeState(value?: string): InstanceState {
  if (value && VALID_STATES.includes(value as InstanceState)) {
    return value as InstanceState;
  }

  return "running";
}

function normalizeMetrics(instance: RawMonitoringInstance): MonitoringMetrics {
  const nestedMetrics = instance.metrics ?? {};

  return {
    cpuUtilization: Number(nestedMetrics.cpuUtilization ?? instance.cpuPercent ?? 0),
    memoryUtilization: Number(
      nestedMetrics.memoryUtilization ?? instance.memoryUtilization ?? 0,
    ),
    networkInBytes: Number(nestedMetrics.networkInBytes ?? instance.networkInBytes ?? 0),
    networkOutBytes: Number(
      nestedMetrics.networkOutBytes ?? instance.networkOutBytes ?? 0,
    ),
    diskReadOps: Number(nestedMetrics.diskReadOps ?? instance.diskReadOps ?? 0),
    diskWriteOps: Number(nestedMetrics.diskWriteOps ?? instance.diskWriteOps ?? 0),
  };
}

function normalizeInstance(instance: RawMonitoringInstance): MonitoringInstance {
  const id = instance.id ?? instance.instanceId ?? "unknown-instance";

  return {
    id,
    name: instance.name?.trim() || id,
    state: normalizeState(instance.state),
    type: instance.type ?? "unknown",
    metrics: normalizeMetrics(instance),
  };
}

export async function fetchMonitoring(range?: string): Promise<MonitoringResponse> {
  const response = await baseApiFetch<RawMonitoringResponse>(
    buildMonitoringUrl(range),
  );

  return {
    region: response.region ?? "unknown",
    timestamp: response.timestamp ?? new Date().toISOString(),
    instances: (response.instances ?? []).map(normalizeInstance),
  };
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string,
): Promise<MonitoringInstance | null> {
  const response = await fetchMonitoring(range);
  return response.instances.find((instance) => instance.id === instanceId) ?? null;
}
