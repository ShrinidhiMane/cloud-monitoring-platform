export interface MonitoringMetricPoint {
  timestamp?: string;
  label: string;
  value: number;
}

export type CpuUsagePoint = MonitoringMetricPoint;
