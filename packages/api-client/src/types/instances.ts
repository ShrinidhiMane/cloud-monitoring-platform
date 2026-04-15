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
  zone?: string;
}

export interface MonitoringInstance extends InstanceSummary {
  cpuPercent: number;
  memoryPercent: number;
  networkInBytes: number;
  networkOutBytes: number;
  diskReadOps: number;
  diskWriteOps: number;
  cpuSeries: import("./metrics").CpuUsagePoint[];
  updatedAt: string;
}

export interface MonitoringResponse {
  instances: MonitoringInstance[];
  region: string;
  timestamp: string;
}

export type InstancePowerAction = "start" | "stop" | "reboot";

export interface InstancePowerResponse {
  instanceId: string;
  action: InstancePowerAction;
  status: "accepted";
  previousState: InstanceState | null;
  currentState: InstanceState | null;
  requestId: string | null;
}
