import {
  API_URL,
  apiFetch as baseApiFetch,
  controlInstancePower as controlSharedInstancePower,
  createApiClient,
  fetchInstanceMonitoring as fetchSharedInstanceMonitoring,
  fetchMonitoringOverview,
  getApiBaseUrl,
  setApiBaseUrl,
} from "../../../packages/api-client/src";

import type {
  ApiClient,
  InstancePowerAction,
  InstancePowerResponse,
  InstanceState,
  MonitoringInstance,
  MonitoringResponse,
  OpenApiPaths,
} from "../../../packages/api-client/src";

export interface MonitoringMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadOps: number;
  diskWriteOps: number;
}

export {
  API_URL,
  baseApiFetch as apiFetch,
  createApiClient,
  getApiBaseUrl,
  setApiBaseUrl,
};

export type {
  ApiClient,
  InstancePowerAction,
  InstancePowerResponse,
  InstanceState,
  MonitoringInstance,
  MonitoringResponse,
  OpenApiPaths,
};

export async function fetchMonitoring(
  range?: string,
): Promise<MonitoringResponse> {
  return fetchMonitoringOverview(range);
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string,
): Promise<MonitoringInstance | null> {
  return fetchSharedInstanceMonitoring(instanceId, range);
}

export async function controlInstancePower(
  instanceId: string,
  action: InstancePowerAction,
): Promise<InstancePowerResponse> {
  return controlSharedInstancePower(instanceId, action);
}
