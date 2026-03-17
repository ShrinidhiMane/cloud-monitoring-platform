import type { MetricSeriesPoint } from "./metrics";

export type InstanceState =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "shutting-down"
  | "terminated"
  | "unknown";

export interface InstanceSummary {
  id: string;
  name: string;
  state: InstanceState;
  type: string;
  availabilityZone?: string | null;
  publicIp?: string | null;
}

export interface MonitoringInstance {
  id: string;
  instanceId: string;
  name: string;
  state: InstanceState;
  type: string;
  availabilityZone: string | null;
  publicIp: string | null;
  imageId: string | null;
  launchedAt: string | null;
  cpuPercent: number;
  memoryPercent: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadOps: number;
  diskWriteOps: number;
  statusCheckFailed: number;
  cpuSeries: MetricSeriesPoint[];
  memorySeries: MetricSeriesPoint[];
  networkInSeries: MetricSeriesPoint[];
  networkOutSeries: MetricSeriesPoint[];
}

export interface MonitoringResponse {
  instances: MonitoringInstance[];
  region: string;
  timestamp: string;
  range: string;
}
