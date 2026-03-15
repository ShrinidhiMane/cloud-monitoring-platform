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

export interface MonitoringResponse {
  instances: MonitoringInstance[];
  region: string;
  timestamp: Date;
}
