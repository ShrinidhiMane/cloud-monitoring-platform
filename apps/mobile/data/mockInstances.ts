import type { InstanceSummary } from "api-client";

export const mockInstances: InstanceSummary[] = [
  {
    id: "i-0a12bc34de56f7890",
    name: "web-prod-01",
    state: "running",
    type: "t3.medium",
  },
  {
    id: "i-1234abcd5678efgh9",
    name: "db-prod-01",
    state: "stopped",
    type: "m5.large",
  },
  {
    id: "i-98zyxw76vu54ts32r",
    name: "worker-queue-01",
    state: "pending",
    type: "t3.small",
  },
  {
    id: "i-0f1e2d3c4b5a6978",
    name: "analytics-01",
    state: "running",
    type: "c6i.large",
  },
];
