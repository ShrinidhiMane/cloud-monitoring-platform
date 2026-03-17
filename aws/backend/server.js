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
      return { durationMs: 60 * 60 * 1000, period: 300 };
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

function getLatestStat(metricResponse, statKey) {
  const datapoints = metricResponse?.Datapoints ?? [];
  if (!datapoints.length) {
    return 0;
  }

  const sorted = [...datapoints].sort(
    (a, b) => new Date(a.Timestamp) - new Date(b.Timestamp),
  );

  return sorted[sorted.length - 1]?.[statKey] ?? 0;
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

async function fetchBasicInstanceMetrics(instance, startTime, endTime, period) {
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
  ]);

  return {
    instanceId,
    state: instance.State?.Name ?? "unknown",
    type: instance.InstanceType,
    metrics: {
      cpuUtilization: safeRound(getLatestStat(cpuData, "Average")),
      memoryUtilization: safeRound(getLatestStat(memoryData, "Average")),
      networkInBytes: Math.round(getLatestStat(netInData, "Sum")),
      networkOutBytes: Math.round(getLatestStat(netOutData, "Sum")),
      diskReadOps: Math.round(getLatestStat(diskReadData, "Sum")),
      diskWriteOps: Math.round(getLatestStat(diskWriteData, "Sum")),
    },
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

    const instances = await Promise.all(
      allInstances.map((instance) =>
        fetchBasicInstanceMetrics(instance, startTime, endTime, period),
      ),
    );

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
