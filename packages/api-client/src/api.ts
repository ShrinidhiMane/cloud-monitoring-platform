import { getApiBaseUrl } from "./constants";
import { MonitoringInstance } from "./types";

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

  // console.log(`Received response: ${res.status} ${res.statusText}`);
}

function buildMonitoringUrl(range?: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (!range) {
    return `${base}/monitoring`;
  }
  return `${base}/monitoring?range=${encodeURIComponent(range)}`;
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string,
): Promise<MonitoringInstance | null> {
  const instances: MonitoringInstance[] = await apiFetch(
    buildMonitoringUrl(range),
  );
  return instances.find((instance) => instance.id === instanceId) ?? null;
}
