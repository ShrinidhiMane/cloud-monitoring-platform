import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import AWS, { type CloudWatch, type EC2 } from "aws-sdk";
import {
  type InstanceState,
  type MetricSeriesPoint,
  type MonitoringInstance,
  type MonitoringResponse,
} from "api-client";

const app = express();
app.use(cors());
app.use(express.json());

AWS.config.update({ region: "us-east-2" });

const ec2 = new AWS.EC2();
const cloudwatch = new AWS.CloudWatch();

const PORT = 5000;
const CACHE_TTL_MS = 30 * 1000;
const monitoringCache = new Map<string, { createdAt: number; payload: MonitoringResponse }>();

type MonitoringRange = "1h" | "6h" | "12h" | "24h" | "7d";
type DatapointStatKey = "Average" | "Sum" | "Maximum";
type FetchMetricParams = {
  namespace: string;
  metricName: string;
  dimensions: CloudWatch.Dimensions;
  startTime: Date;
  endTime: Date;
  period: number;
  statistics: CloudWatch.Statistics;
};

function normalizeRange(range: unknown): MonitoringRange {
  const allowedRanges: Set<MonitoringRange> = new Set(["1h", "6h", "12h", "24h", "7d"]);
  if (typeof range !== "string") {
    return "1h";
  }
  return allowedRanges.has(range as MonitoringRange) ? (range as MonitoringRange) : "1h";
}

function getWindowForRange(range: MonitoringRange): { durationMs: number; period: number } {
  switch (range) {
    case "6h":
      return { durationMs: 6 * 60 * 60 * 1000, period: 900 };
    case "12h":
      return { durationMs: 12 * 60 * 60 * 1000, period: 1800 };
    case "24h":
      return { durationMs: 24 * 60 * 60 * 1000, period: 3600 };
    case "7d":
      return { durationMs: 7 * 24 * 60 * 60 * 1000, period: 21600 };
    case "1h":
    default:
      return { durationMs: 60 * 60 * 60 * 1000 / 60, period: 300 };
  }
}

function getCacheEntry(key: string): MonitoringResponse | null {
  const entry = monitoringCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    monitoringCache.delete(key);
    return null;
  }

  return entry.payload;
}

function setCacheEntry(key: string, payload: MonitoringResponse): void {
  monitoringCache.set(key, {
    createdAt: Date.now(),
    payload,
  });
}

function safeRound(value: number | undefined, digits = 2): number {
  return Number(Number(value ?? 0).toFixed(digits));
}

function sortDatapoints(datapoints: CloudWatch.Datapoints | undefined): CloudWatch.Datapoints {
  return [...(datapoints ?? [])].sort(
    (a, b) =>
      new Date(a.Timestamp ?? 0).getTime() -
      new Date(b.Timestamp ?? 0).getTime(),
  );
}

function getLatestStat(
  metricResponse: CloudWatch.GetMetricStatisticsOutput,
  statKey: DatapointStatKey,
): number {
  const sorted = sortDatapoints(metricResponse?.Datapoints ?? []);
  if (!sorted.length) {
    return 0;
  }

  return Number(sorted[sorted.length - 1]?.[statKey] ?? 0);
}

function formatPointLabel(timestamp: Date | string | undefined, range: MonitoringRange): string {
  const date = new Date(timestamp ?? 0);

  if (range === "7d") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapSeries(
  metricResponse: CloudWatch.GetMetricStatisticsOutput,
  statKey: DatapointStatKey,
  range: MonitoringRange,
): MetricSeriesPoint[] {
  const sorted = sortDatapoints(metricResponse?.Datapoints ?? []);

  return sorted.map((point: CloudWatch.Datapoint) => ({
    timestamp: new Date(point.Timestamp ?? 0).toISOString(),
    label: formatPointLabel(point.Timestamp, range),
    value: safeRound(Number(point[statKey] ?? 0)),
  }));
}

function getInstanceName(instance: EC2.Instance): string {
  const tags = instance.Tags ?? [];
  const nameTag = tags.find((tag: EC2.Tag) => tag.Key === "Name");
  return nameTag?.Value || instance.InstanceId || "unknown-instance";
}

async function fetchMetric({
  namespace,
  metricName,
  dimensions,
  startTime,
  endTime,
  period,
  statistics,
}: FetchMetricParams): Promise<CloudWatch.GetMetricStatisticsOutput> {
  return cloudwatch
    .getMetricStatistics({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: statistics,
    })
    .promise();
}

async function fetchExtendedInstanceMetrics(
  instance: EC2.Instance,
  startTime: Date,
  endTime: Date,
  period: number,
  range: MonitoringRange,
): Promise<MonitoringInstance> {
  const instanceId = instance.InstanceId ?? "unknown-instance";
  const ec2Dimensions: CloudWatch.Dimensions = [{ Name: "InstanceId", Value: instanceId }];
  const memoryDimensions: CloudWatch.Dimensions = [
    { Name: "InstanceId", Value: instanceId },
    { Name: "ImageId", Value: instance.ImageId ?? "unknown" },
    { Name: "InstanceType", Value: instance.InstanceType ?? "unknown" },
  ];

  const [
    cpuData,
    netInData,
    netOutData,
    diskReadData,
    diskWriteData,
    memoryData,
    statusCheckData,
  ] = await Promise.all([
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "CPUUtilization",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Average"],
    }),
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "NetworkIn",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Sum"],
    }),
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "NetworkOut",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Sum"],
    }),
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "DiskReadOps",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Sum"],
    }),
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "DiskWriteOps",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Sum"],
    }),
    fetchMetric({
      namespace: "CWAgent",
      metricName: "mem_used_percent",
      dimensions: memoryDimensions,
      startTime,
      endTime,
      period,
      statistics: ["Average"],
    }),
    fetchMetric({
      namespace: "AWS/EC2",
      metricName: "StatusCheckFailed",
      dimensions: ec2Dimensions,
      startTime,
      endTime,
      period,
      statistics: ["Maximum"],
    }),
  ]);

  return {
    id: instanceId,
    instanceId,
    name: getInstanceName(instance),
    state: (instance.State?.Name as InstanceState) ?? "unknown",
    type: instance.InstanceType ?? "unknown",
    availabilityZone: instance.Placement?.AvailabilityZone ?? "unknown",
    publicIp: instance.PublicIpAddress ?? null,
    imageId: instance.ImageId ?? null,
    launchedAt: instance.LaunchTime
      ? new Date(instance.LaunchTime).toISOString()
      : null,
    cpuPercent: safeRound(getLatestStat(cpuData, "Average")),
    memoryPercent: safeRound(getLatestStat(memoryData, "Average")),
    networkInBytes: Math.round(getLatestStat(netInData, "Sum")),
    networkOutBytes: Math.round(getLatestStat(netOutData, "Sum")),
    diskReadOps: Math.round(getLatestStat(diskReadData, "Sum")),
    diskWriteOps: Math.round(getLatestStat(diskWriteData, "Sum")),
    statusCheckFailed: Math.round(getLatestStat(statusCheckData, "Maximum")),
    cpuSeries: mapSeries(cpuData, "Average", range),
    memorySeries: mapSeries(memoryData, "Average", range),
    networkInSeries: mapSeries(netInData, "Sum", range),
    networkOutSeries: mapSeries(netOutData, "Sum", range),
  } as Partial<MonitoringInstance> as MonitoringInstance;
}

app.get("/monitoring", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = normalizeRange(req.query.range);
    const cacheKey = `monitoring:${range}`;
    const cachedPayload = getCacheEntry(cacheKey);

    if (cachedPayload) {
      return res.json(cachedPayload);
    }

    const { durationMs, period } = getWindowForRange(range);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMs);

    const ec2Data = await ec2
      .describeInstances({
        Filters: [{ Name: "instance-state-name", Values: ["running"] }],
      })
      .promise();

    const allInstances = (ec2Data.Reservations ?? []).flatMap(
      (reservation: EC2.Reservation) => reservation.Instances ?? [],
    );

    const result: MonitoringInstance[] = [];

    for (const reservation of ec2Data.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        const instanceId = instance.InstanceId ?? "unknown-instance";
        const name =
          instance.Tags?.find((tag: EC2.Tag) => tag.Key === "Name")?.Value ?? instanceId;
        const state = (instance.State?.Name as InstanceState) ?? "unknown";
        const type = instance.InstanceType ?? "unknown";

        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

        const [
          cpuData,
          netInData,
          netOutData,
          diskReadData,
          diskWriteData,
          memoryData,
        ] = await Promise.all([
          cloudwatch
            .getMetricStatistics({
              Namespace: "AWS/EC2",
              MetricName: "CPUUtilization",
              Dimensions: [{ Name: "InstanceId", Value: instanceId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Average"],
            })
            .promise(),

          cloudwatch
            .getMetricStatistics({
              Namespace: "AWS/EC2",
              MetricName: "NetworkIn",
              Dimensions: [{ Name: "InstanceId", Value: instanceId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Sum"],
            })
            .promise(),

          cloudwatch
            .getMetricStatistics({
              Namespace: "AWS/EC2",
              MetricName: "NetworkOut",
              Dimensions: [{ Name: "InstanceId", Value: instanceId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Sum"],
            })
            .promise(),

          cloudwatch
            .getMetricStatistics({
              Namespace: "AWS/EC2",
              MetricName: "DiskReadOps",
              Dimensions: [{ Name: "InstanceId", Value: instanceId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Sum"],
            })
            .promise(),

          cloudwatch
            .getMetricStatistics({
              Namespace: "AWS/EC2",
              MetricName: "DiskWriteOps",
              Dimensions: [{ Name: "InstanceId", Value: instanceId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Sum"],
            })
            .promise(),

          cloudwatch
            .getMetricStatistics({
              Namespace: "CWAgent",
              MetricName: "mem_used_percent",
              Dimensions: [
                { Name: "InstanceId", Value: instanceId },
                { Name: "ImageId", Value: instance.ImageId ?? "unknown" },
                { Name: "InstanceType", Value: instance.InstanceType ?? "unknown" },
              ],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Average"],
            })
            .promise(),
        ]);

        const cpuValue = cpuData.Datapoints?.length
          ? Number(cpuData.Datapoints.at(-1)?.Average ?? 0)
          : 0;

        const networkIn = netInData.Datapoints?.length
          ? Number(netInData.Datapoints.at(-1)?.Sum ?? 0)
          : 0;

        const networkOut = netOutData.Datapoints?.length
          ? Number(netOutData.Datapoints.at(-1)?.Sum ?? 0)
          : 0;

        const diskRead = diskReadData.Datapoints?.length
          ? Number(diskReadData.Datapoints.at(-1)?.Sum ?? 0)
          : 0;

        const diskWrite = diskWriteData.Datapoints?.length
          ? Number(diskWriteData.Datapoints.at(-1)?.Sum ?? 0)
          : 0;

        const memoryValue = memoryData.Datapoints?.length
          ? Number(memoryData.Datapoints.at(-1)?.Average ?? 0)
          : 0;

        result.push({
          id: instanceId,
          instanceId,
          name,
          state,
          type,
          availabilityZone: instance.Placement?.AvailabilityZone ?? "unknown",
          publicIp: instance.PublicIpAddress ?? null,
          imageId: instance.ImageId ?? null,
          launchedAt: instance.LaunchTime ? new Date(instance.LaunchTime).toISOString() : null,
          cpuPercent: Number(cpuValue.toFixed(2)),
          memoryPercent: Number(memoryValue.toFixed(2)),
          networkInBytes: networkIn,
          networkOutBytes: networkOut,
          diskReadOps: diskRead,
          diskWriteOps: diskWrite,
          statusCheckFailed: 0,
          cpuSeries: [],
          memorySeries: [],
          networkInSeries: [],
          networkOutSeries: [],
        } as Partial<MonitoringInstance> as MonitoringInstance);
      }
    }

    const instances: MonitoringInstance[] = result.length
      ? result
      : await Promise.all(
          allInstances.map((instance) =>
            fetchExtendedInstanceMetrics(instance, startTime, endTime, period, range),
          ),
        );

    const payload: MonitoringResponse = {
      timestamp: new Date().toISOString(),
      region: (AWS.config.region as string) ?? "us-east-2",
      range,
      instances,
    };

    setCacheEntry(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

app.use((req: Request, res: Response) => {
  void req;
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  void req;
  void next;
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
