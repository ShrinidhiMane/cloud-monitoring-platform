export interface CpuUsagePoint {
  timestamp?: string;
  label: string;
  value: number;
}

export type CpuUsagePoint = MetricSeriesPoint;
