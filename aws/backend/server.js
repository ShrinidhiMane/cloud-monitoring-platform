import express from "express";
import cors from "cors";
import AWS from "aws-sdk";

AWS.config.update({ region: "us-east-2" });

const POWER_ACTIONS = new Set(["start", "stop"]);
const DEFAULT_RANGE = "1h";

const RANGE_CONFIG = {
  "15m": {
    lookbackMs: 15 * 60 * 1000,
    period: 60,
  },
  "1h": {
    lookbackMs: 60 * 60 * 1000,
    period: 60,
  },
  "6h": {
    lookbackMs: 6 * 60 * 60 * 1000,
    period: 300,
  },
  "24h": {
    lookbackMs: 24 * 60 * 60 * 1000,
    period: 900,
  },
};

const createAwsClients = () => ({
  ec2: new AWS.EC2(),
  cloudwatch: new AWS.CloudWatch(),
  s3: new AWS.S3(),
});

const safeAwsCall = async (operation, fallback = null) => {
  try {
    return await operation();
  } catch (error) {
    console.error("AWS operation failed:", error.message);
    return fallback;
  }
};

const safeNumber = (value, digits = null) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return digits !== null ? Number(numericValue.toFixed(digits)) : numericValue;
};

const buildErrorResponse = (error, defaultMessage = "Request failed") => ({
  error: error?.code || "InternalServerError",
  message: error?.message || defaultMessage,
});

function getRangeConfig(range) {
  if (typeof range !== "string") {
    return RANGE_CONFIG[DEFAULT_RANGE];
  }

  return RANGE_CONFIG[range] ?? RANGE_CONFIG[DEFAULT_RANGE];
}

function roundMetricValue(value) {
  return Number((value ?? 0).toFixed(2));
}

function sortDatapoints(datapoints = []) {
  return [...datapoints].sort((left, right) => {
    return (
      new Date(left.Timestamp).getTime() - new Date(right.Timestamp).getTime()
    );
  });
}

function getLatestMetric(data, field) {
  if (!data?.Datapoints?.length) {
    return 0;
  }

  const latestPoint = sortDatapoints(data.Datapoints)
    .filter((point) => point?.Timestamp)
    .at(-1);

  return Number(latestPoint?.[field] ?? 0);
}

function getLastMetricValue(datapoints, metricKey) {
  const latestPoint = sortDatapoints(datapoints).at(-1);
  return roundMetricValue(latestPoint?.[metricKey]);
}

function toIsoTimestamp(timestamp) {
  return timestamp instanceof Date
    ? timestamp.toISOString()
    : new Date(timestamp).toISOString();
}

function buildCpuSeries(datapoints = []) {
  return sortDatapoints(datapoints).map((point) => ({
    timestamp: toIsoTimestamp(point.Timestamp),
    value: roundMetricValue(point.Average),
  }));
}

function getInstanceName(instance) {
  return (
    instance.Tags?.find((tag) => tag.Key === "Name")?.Value ??
    instance.InstanceId
  );
}

export const createApp = (clients = createAwsClients()) => {
  const { ec2, cloudwatch, s3 } = clients;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/monitoring", async (req, res, next) => {
    try {
      const result = [];
      const s3Buckets = [];
      const responseTimestamp = new Date().toISOString();
      const { lookbackMs, period } = getRangeConfig(req.query.range);

      const ec2Data = await safeAwsCall(
        () =>
          ec2
            .describeInstances({
              Filters: [
  {
    Name: "instance-state-name",
    Values: ["pending", "running", "stopping", "stopped"],
  },
],
            })
            .promise(),
        { Reservations: [] },
      );

      for (const reservation of ec2Data.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const instanceId = instance.InstanceId;
          const state = instance.State?.Name ?? "unknown";
          const type = instance.InstanceType ?? "unknown";
          const name = getInstanceName(instance);
          const zone = instance.Placement?.AvailabilityZone ?? null;

          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - lookbackMs);

          const [
            cpuData,
            netInData,
            netOutData,
            diskReadData,
            diskWriteData,
            memoryData,
          ] = await Promise.all([
            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/EC2",
                    MetricName: "CPUUtilization",
                    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    Statistics: ["Average"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/EC2",
                    MetricName: "NetworkIn",
                    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    Statistics: ["Sum"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/EC2",
                    MetricName: "NetworkOut",
                    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    Statistics: ["Sum"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/EC2",
                    MetricName: "DiskReadOps",
                    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    Statistics: ["Sum"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/EC2",
                    MetricName: "DiskWriteOps",
                    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    Statistics: ["Sum"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
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
                    Period: period,
                    Statistics: ["Average"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),
          ]);

          const cpuSeries = buildCpuSeries(cpuData.Datapoints);
          const latestCpuPoint = cpuSeries.at(-1);

          result.push({
            id: instanceId,
            name,
            state,
            type,
            zone,
            network: {
              privateIP: instance.PrivateIpAddress || null,
              publicIP: instance.PublicIpAddress || null,
              subnetId: instance.SubnetId || null,
              vpcId: instance.VpcId || null,
              securityGroups: (instance.SecurityGroups || []).map(
                (group) => group.GroupName,
              ),
            },
            cpuPercent: getLastMetricValue(cpuData.Datapoints, "Average"),
            memoryPercent: getLastMetricValue(memoryData.Datapoints, "Average"),
            networkInBytes: getLastMetricValue(netInData.Datapoints, "Sum"),
            networkOutBytes: getLastMetricValue(netOutData.Datapoints, "Sum"),
            diskReadOps: getLastMetricValue(diskReadData.Datapoints, "Sum"),
            diskWriteOps: getLastMetricValue(diskWriteData.Datapoints, "Sum"),
            metrics: {
              cpuUtilization: safeNumber(getLatestMetric(cpuData, "Average"), 2),
              memoryUtilization: safeNumber(
                getLatestMetric(memoryData, "Average"),
                2,
              ),
              networkInBytes: getLatestMetric(netInData, "Sum"),
              networkOutBytes: getLatestMetric(netOutData, "Sum"),
              diskReadOps: getLatestMetric(diskReadData, "Sum"),
              diskWriteOps: getLatestMetric(diskWriteData, "Sum"),
            },
            cpuSeries,
            updatedAt: latestCpuPoint?.timestamp ?? responseTimestamp,
          });
        }
      }

      const bucketList = await safeAwsCall(
        () => s3.listBuckets().promise(),
        { Buckets: [] },
      );

      for (const bucket of bucketList.Buckets || []) {
        try {
          const s3End = new Date();
          const s3Start = new Date(s3End.getTime() - 7 * 24 * 60 * 60 * 1000);

          const [sizeData, objectData] = await Promise.all([
            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/S3",
                    MetricName: "BucketSizeBytes",
                    Dimensions: [
                      { Name: "BucketName", Value: bucket.Name },
                      { Name: "StorageType", Value: "StandardStorage" },
                    ],
                    StartTime: s3Start,
                    EndTime: s3End,
                    Period: 86400,
                    Statistics: ["Average"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),

            safeAwsCall(
              () =>
                cloudwatch
                  .getMetricStatistics({
                    Namespace: "AWS/S3",
                    MetricName: "NumberOfObjects",
                    Dimensions: [
                      { Name: "BucketName", Value: bucket.Name },
                      { Name: "StorageType", Value: "AllStorageTypes" },
                    ],
                    StartTime: s3Start,
                    EndTime: s3End,
                    Period: 86400,
                    Statistics: ["Average"],
                  })
                  .promise(),
              { Datapoints: [] },
            ),
          ]);

          let encryptionEnabled = false;
          try {
            await s3.getBucketEncryption({ Bucket: bucket.Name }).promise();
            encryptionEnabled = true;
          } catch {}

          let publicAccessBlocked = false;
          try {
            const publicAccess = await s3
              .getPublicAccessBlock({ Bucket: bucket.Name })
              .promise();

            publicAccessBlocked =
              publicAccess.PublicAccessBlockConfiguration.BlockPublicAcls &&
              publicAccess.PublicAccessBlockConfiguration.BlockPublicPolicy &&
              publicAccess.PublicAccessBlockConfiguration.IgnorePublicAcls &&
              publicAccess.PublicAccessBlockConfiguration.RestrictPublicBuckets;
          } catch {}

          s3Buckets.push({
            bucketName: bucket.Name,
            bucketSizeBytes: getLatestMetric(sizeData, "Average"),
            numberOfObjects: getLatestMetric(objectData, "Average"),
            encryptionEnabled,
            publicAccessBlocked,
          });
        } catch (error) {
          console.error("S3 monitoring error:", error.message);
        }
      }

      const sgData = await safeAwsCall(
        () => ec2.describeSecurityGroups().promise(),
        { SecurityGroups: [] },
      );

let overallStatus = "healthy";

if (!result.length) {
  overallStatus = "unknown";
} else if (result.some(inst => inst.state !== "running")) {
  overallStatus = "degraded";
}
      res.status(200).json({
  timestamp: responseTimestamp,
  region: AWS.config.region,
  status: overallStatus,
  instances: result,
  s3: s3Buckets,
        security: (sgData.SecurityGroups || []).map((group) => ({
          groupId: group.GroupId,
          groupName: group.GroupName,
          description: group.Description,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/instances/:instanceId/power", async (req, res, next) => {
    try {
      const { instanceId } = req.params;
      const action = req.body?.action;

      if (!instanceId) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Path parameter 'instanceId' is required",
        });
      }

      if (!POWER_ACTIONS.has(action)) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Body field 'action' must be either 'start' or 'stop'",
        });
      }

      const request = { InstanceIds: [instanceId] };
      const response =
        action === "start"
          ? await ec2.startInstances(request).promise()
          : await ec2.stopInstances(request).promise();

      const transitions =
        action === "start"
          ? response.StartingInstances || []
          : response.StoppingInstances || [];

      const transition =
        transitions.find((item) => item.InstanceId === instanceId) || null;

      return res.status(200).json({
        instanceId,
        action,
        status: "accepted",
        previousState: transition?.PreviousState?.Name || null,
        currentState: transition?.CurrentState?.Name || null,
        requestId: response.$response?.requestId || null,
      });
    } catch (error) {
      if (error?.code === "InvalidInstanceID.NotFound") {
        return res.status(404).json({
          error: error.code,
          message: error.message,
        });
      }

      if (error?.code === "IncorrectInstanceState") {
        return res.status(409).json({
          error: error.code,
          message: error.message,
        });
      }

      return next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Route was not found" });
  });

  app.use((err, req, res, next) => {
    console.error("Backend Error:", err);
    res.status(500).json(buildErrorResponse(err, "Internal server error"));
  });

  return app;
};

const PORT = 5000;

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}