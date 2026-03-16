export type InstanceState =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "shutting-down"
  | "terminated";

export interface InstanceSummary {
  id: string;
  name: string;
  state: InstanceState;
  type: string;
}

export interface MonitoringMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadOps: number;
  diskWriteOps: number;
}

export interface MonitoringInstance extends InstanceSummary {
  metrics: MonitoringMetrics;
}

export interface MonitoringResponse {
  instances: MonitoringInstance[];
  region: string;
  timestamp: string;
}
