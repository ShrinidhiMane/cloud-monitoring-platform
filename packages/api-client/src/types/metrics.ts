export interface MetricSeriesPoint {
  timestamp: string;
  label: string;
  value: number;
}

export type CpuUsagePoint = MetricSeriesPoint;
