const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");

const app = express();
app.use(cors());
app.use(express.json());

AWS.config.update({ region: "us-east-2" });

const ec2 = new AWS.EC2();
const cloudwatch = new AWS.CloudWatch();

const PORT = 5000;
const CACHE_TTL_MS = 30 * 1000;
const monitoringCache = new Map();

function normalizeRange(range) {
  const allowedRanges = new Set(["1h", "6h", "12h", "24h", "7d"]);
  return allowedRanges.has(range) ? range : "1h";
}

function getWindowForRange(range) {
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

function getCacheEntry(key) {
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

function setCacheEntry(key, payload) {
  monitoringCache.set(key, {
    createdAt: Date.now(),
    payload,
  });
}

function safeRound(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function sortDatapoints(datapoints) {
  return [...(datapoints ?? [])].sort(
    (a, b) => new Date(a.Timestamp) - new Date(b.Timestamp),
  );
}

function getLatestStat(metricResponse, statKey) {
  const sorted = sortDatapoints(metricResponse?.Datapoints ?? []);
  if (!sorted.length) {
    return 0;
  }

  return sorted[sorted.length - 1]?.[statKey] ?? 0;
}

function formatPointLabel(timestamp, range) {
  const date = new Date(timestamp);

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

function mapSeries(metricResponse, statKey, range) {
  const sorted = sortDatapoints(metricResponse?.Datapoints ?? []);

  return sorted.map((point) => ({
    timestamp: new Date(point.Timestamp).toISOString(),
    label: formatPointLabel(point.Timestamp, range),
    value: safeRound(point[statKey] ?? 0),
  }));
}

function getInstanceName(instance) {
  const tags = instance.Tags ?? [];
  const nameTag = tags.find((tag) => tag.Key === "Name");
  return nameTag?.Value || instance.InstanceId;
}

async function fetchMetric({
  namespace,
  metricName,
  dimensions,
  startTime,
  endTime,
  period,
  statistics,
}) {
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

async function fetchExtendedInstanceMetrics(instance, startTime, endTime, period, range) {
  const instanceId = instance.InstanceId;
  const ec2Dimensions = [{ Name: "InstanceId", Value: instanceId }];
  const memoryDimensions = [
    { Name: "InstanceId", Value: instanceId },
    { Name: "ImageId", Value: instance.ImageId },
    { Name: "InstanceType", Value: instance.InstanceType },
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
    state: instance.State?.Name ?? "unknown",
    type: instance.InstanceType,
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
  };
}

app.get("/monitoring", async (req, res, next) => {
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
      (reservation) => reservation.Instances ?? [],
    );

    for (const reservation of ec2Data.Reservations) {
      for (const instance of reservation.Instances) {
        const instanceId = instance.InstanceId;
        const name =
          instance.Tags?.find((tag) => tag.Key === "Name")?.Value ?? instanceId;
        const state = instance.State.Name;
        const type = instance.InstanceType;

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
                { Name: "ImageId", Value: instance.ImageId },
                { Name: "InstanceType", Value: instance.InstanceType },
              ],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Average"],
            })
            .promise(),
        ]);

        const cpuValue = cpuData.Datapoints.length
          ? cpuData.Datapoints.at(-1).Average
          : 0;

        const networkIn = netInData.Datapoints.length
          ? netInData.Datapoints.at(-1).Sum
          : 0;

        const networkOut = netOutData.Datapoints.length
          ? netOutData.Datapoints.at(-1).Sum
          : 0;

        const diskRead = diskReadData.Datapoints.length
          ? diskReadData.Datapoints.at(-1).Sum
          : 0;

        const diskWrite = diskWriteData.Datapoints.length
          ? diskWriteData.Datapoints.at(-1).Sum
          : 0;

        const memoryValue = memoryData.Datapoints.length
          ? memoryData.Datapoints.at(-1).Average
          : 0;

        result.push({
          id: instanceId,
          name,
          state,
          type,
          metrics: {
            cpuUtilization: Number(cpuValue.toFixed(2)),
            memoryUtilization: Number(memoryValue.toFixed(2)),
            networkInBytes: networkIn,
            networkOutBytes: networkOut,
            diskReadOps: diskRead,
            diskWriteOps: diskWrite,
          },
        });
      }
    }

    const payload = {
      timestamp: new Date().toISOString(),
      region: AWS.config.region,
      range,
      instances,
    };

    setCacheEntry(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
