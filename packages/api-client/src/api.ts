import { getApiBaseUrl } from "./constants";
import { MonitoringInstance, MonitoringResponse } from "./types";

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`${baseUrl}${endpoint}`, {
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
  if (!range) {
    return "/monitoring";
  }
  return `/monitoring?range=${encodeURIComponent(range)}`;
}

export async function fetchMonitoring(
  range?: string,
): Promise<MonitoringResponse> {
  return apiFetch<MonitoringResponse>(buildMonitoringUrl(range));
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string,
): Promise<MonitoringInstance | null> {
  const response = await fetchMonitoring(range);
  return (
    response.instances.find((instance) => instance.id === instanceId) ?? null
  );
}
