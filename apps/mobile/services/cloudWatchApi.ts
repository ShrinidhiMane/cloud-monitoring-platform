import type { InstanceState } from "@/types/instances";

const DEFAULT_API_BASE_URL = "http://localhost:5000";
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL;

export interface MonitoringInstance {
  id: string;
  state: InstanceState;
  type: string;
  cpuPercent: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadOps: number;
  diskWriteOps: number;
}

interface MonitoringResponse {
  instances: MonitoringInstance[];
}

function buildMonitoringUrl(range?: string): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  if (!range) {
    return `${base}/monitoring`;
  }

  return `${base}/monitoring?range=${encodeURIComponent(range)}`;
}

export async function fetchMonitoring(range?: string): Promise<MonitoringInstance[]> {
  const res = await fetch(buildMonitoringUrl(range));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monitoring request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as MonitoringResponse;
  return data.instances ?? [];
}

export async function fetchInstanceMonitoring(
  instanceId: string,
  range?: string
): Promise<MonitoringInstance | null> {
  const instances = await fetchMonitoring(range);
  return instances.find((instance) => instance.id === instanceId) ?? null;
}
