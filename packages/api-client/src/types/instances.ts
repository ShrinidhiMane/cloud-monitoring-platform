export type InstanceState =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "shutting-down"
  | "terminated"
  | "unknown";

export type MonitoringStatus = "healthy" | "degraded" | "unknown";

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
  cpuSeries: import("./metrics").MonitoringMetricPoint[];
  memorySeries: import("./metrics").MonitoringMetricPoint[];
  networkInSeries: import("./metrics").MonitoringMetricPoint[];
  networkOutSeries: import("./metrics").MonitoringMetricPoint[];
  updatedAt: string;
}

export interface MonitoringAlarmDimension {
  name: string;
  value: string;
}

export interface MonitoringAlarm {
  alarmName: string;
  state: string;
  metric: string;
  namespace: string;
  threshold: number | null;
  comparisonOperator: string | null;
  evaluationPeriods: number | null;
  description: string | null;
  stateReason: string | null;
  updatedAt: string | null;
  instanceId: string | null;
  instanceName: string | null;
  dimensions: MonitoringAlarmDimension[];
}

export interface MonitoringResponse {
  instances: MonitoringInstance[];
  region: string;
  timestamp: string;
  status: MonitoringStatus;
  alarms: MonitoringAlarm[];
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
