import type { InstanceSummary } from "api-client";

export const mockInstances: MonitoringInstance[] = [
  {
    id: "i-0a12bc34de56f7890",
    name: "web-prod-01",
    state: "running",
    type: "t3.medium",
    metrics: {
      cpuUtilization: 26.4,
      memoryUtilization: 58.3,
      networkInBytes: 1823412,
      networkOutBytes: 964352,
      diskReadOps: 112,
      diskWriteOps: 47,
    },
  },
  {
    id: "i-1234abcd5678efgh9",
    name: "db-prod-01",
    state: "stopped",
    type: "m5.large",
    metrics: {
      cpuUtilization: 0,
      memoryUtilization: 0,
      networkInBytes: 0,
      networkOutBytes: 0,
      diskReadOps: 0,
      diskWriteOps: 0,
    },
  },
  {
    id: "i-98zyxw76vu54ts32r",
    name: "worker-queue-01",
    state: "pending",
    type: "t3.small",
    metrics: {
      cpuUtilization: 9.8,
      memoryUtilization: 31.5,
      networkInBytes: 248932,
      networkOutBytes: 126304,
      diskReadOps: 28,
      diskWriteOps: 11,
    },
  },
  {
    id: "i-0f1e2d3c4b5a6978",
    name: "analytics-01",
    state: "running",
    type: "c6i.large",
    metrics: {
      cpuUtilization: 63.2,
      memoryUtilization: 71.6,
      networkInBytes: 5829342,
      networkOutBytes: 4088230,
      diskReadOps: 214,
      diskWriteOps: 143,
    },
  },
];
