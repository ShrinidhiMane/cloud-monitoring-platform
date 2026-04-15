import express from "express";
import cors from "cors";
import AWS from "aws-sdk";

AWS.config.update({ region: "us-east-2" });

const POWER_ACTIONS = new Set(["start", "stop", "reboot"]);

const DEFAULT_RANGE = "1h";

const ALLOWED_INSTANCE_IDS = new Set(
  (process.env.AWS_ALLOWED_INSTANCE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

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
    return new Date(left.Timestamp).getTime() - new Date(right.Timestamp).getTime();
  });
}

function getLastMetricValue(datapoints = [], metricKey) {
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

function getSecurityGroupNames(instance) {
  return (instance.SecurityGroups ?? [])
    .map((group) => group.GroupName ?? group.GroupId)
    .filter(Boolean);
}

async function loadInstanceMetrics(
  cloudwatch,
  instance,
  startTime,
  endTime,
  period,
) {
  const instanceId = instance.InstanceId;

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
        Period: period,
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
        Period: period,
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
        Period: period,
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
        Period: period,
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
        Period: period,
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
        Period: period,
        Statistics: ["Average"],
      })
      .promise(),
  ]);

  const cpuSeries = buildCpuSeries(cpuData.Datapoints);

  return {
    cpuSeries,
    latestCpuPoint: cpuSeries.at(-1),
    metrics: {
      cpuUtilization: getLastMetricValue(cpuData.Datapoints, "Average"),
      memoryUtilization: getLastMetricValue(memoryData.Datapoints, "Average"),
      networkInBytes: getLastMetricValue(netInData.Datapoints, "Sum"),
      networkOutBytes: getLastMetricValue(netOutData.Datapoints, "Sum"),
      diskReadOps: getLastMetricValue(diskReadData.Datapoints, "Sum"),
      diskWriteOps: getLastMetricValue(diskWriteData.Datapoints, "Sum"),
    },
  };
}

async function loadS3Buckets(cloudwatch, s3) {
  const bucketList = await s3.listBuckets().promise();
  const s3Buckets = [];

  for (const bucket of bucketList.Buckets ?? []) {
    if (!bucket.Name) {
      continue;
    }

    try {
      const s3End = new Date();
      const s3Start = new Date(s3End.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [sizeData, objectData] = await Promise.all([
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
        bucketSizeBytes: getLastMetricValue(sizeData.Datapoints, "Average"),
        numberOfObjects: getLastMetricValue(objectData.Datapoints, "Average"),
        encryptionEnabled,
        publicAccessBlocked,
      });
    } catch (error) {
      console.error("S3 monitoring error:", error.message);
    }
  }

  return s3Buckets;
}

async function loadSecurityGroups(ec2) {
  const sgData = await ec2.describeSecurityGroups().promise();

  return (sgData.SecurityGroups ?? []).map((group) => ({
    groupId: group.GroupId,
    groupName: group.GroupName,
    description: group.Description,
  }));
}

async function runPowerAction(ec2, action, request) {
  if (action === "start") {
    return ec2.startInstances(request).promise();
  }

  if (action === "stop") {
    return ec2.stopInstances(request).promise();
  }

  return ec2.rebootInstances(request).promise();
}

function buildPowerActionResponse(instanceId, action, response) {
  let transitions = [];

  if (action === "start") {
    transitions = response.StartingInstances ?? [];
  } else if (action === "stop") {
    transitions = response.StoppingInstances ?? [];
  }

  const transition =
    transitions.find((item) => item.InstanceId === instanceId) ?? null;

  return {
    instanceId,
    action,
    status: "accepted",
    previousState: transition?.PreviousState?.Name ?? null,
    currentState: transition?.CurrentState?.Name ?? null,
    requestId: response.$response?.requestId ?? null,
  };
}

export const createApp = (clients = createAwsClients()) => {
  const { ec2, cloudwatch, s3 } = clients;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/monitoring", async (req, res, next) => {
    try {
      const instances = [];
      const responseTimestamp = new Date().toISOString();
      const { lookbackMs, period } = getRangeConfig(req.query.range);
      const ec2Data = await ec2.describeInstances({}).promise();
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - lookbackMs);

      for (const reservation of ec2Data.Reservations ?? []) {
        for (const instance of reservation.Instances ?? []) {
          const instanceId = instance.InstanceId;

          if (!instanceId) {
            continue;
          }

          const { cpuSeries, latestCpuPoint, metrics } = await loadInstanceMetrics(
            cloudwatch,
            instance,
            startTime,
            endTime,
            period,
          );

          instances.push({
            id: instanceId,
            instanceId,
            name: getInstanceName(instance),
            state: instance.State?.Name ?? "unknown",
            type: instance.InstanceType ?? "unknown",
            zone: instance.Placement?.AvailabilityZone,
            network: {
              privateIP: instance.PrivateIpAddress ?? null,
              publicIP: instance.PublicIpAddress ?? null,
              subnetId: instance.SubnetId ?? null,
              vpcId: instance.VpcId ?? null,
              securityGroups: getSecurityGroupNames(instance),
            },
            metrics,
            cpuPercent: metrics.cpuUtilization,
            memoryPercent: metrics.memoryUtilization,
            networkInBytes: metrics.networkInBytes,
            networkOutBytes: metrics.networkOutBytes,
            diskReadOps: metrics.diskReadOps,
            diskWriteOps: metrics.diskWriteOps,
            cpuSeries,
            updatedAt: latestCpuPoint?.timestamp ?? responseTimestamp,
          });
        }
      }

      const [s3Buckets, securityGroups] = await Promise.all([
        loadS3Buckets(cloudwatch, s3),
        loadSecurityGroups(ec2),
      ]);

      res.status(200).json({
        timestamp: responseTimestamp,
        region: AWS.config.region,
        instances,
        s3: s3Buckets,
        security: securityGroups,
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
          message: "Body field 'action' must be one of 'start', 'stop', or 'reboot'",
        });
      }

      const response = await runPowerAction(ec2, action, {
        InstanceIds: [instanceId],
      });

      return res
        .status(200)
        .json(buildPowerActionResponse(instanceId, action, response));
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
    res.status(404).json({ error: "Route not found" });
  });

  app.use((err, req, res, _next) => {
    console.error("Backend Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  });

  return app;
};

const PORT = process.env.PORT || 5000;

if (process.env.RUN_BACKEND_SERVER === "true") {
  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
