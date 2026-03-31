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

app.get("/monitoring", async (req, res, next) => {
  try {
    const result = [];
    const responseTimestamp = new Date().toISOString();
    const { lookbackMs, period } = getRangeConfig(req.query.range);

    if (rule.isPublic) {
      hasPublic = true;
    }
  }

    if (!ec2Data.Reservations.length) {
      return res.status(200).json({
        timestamp: responseTimestamp,
        region: AWS.config.region,
        securityGroups: securityGroupsData
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
          message: "Path parameter 'instanceId' is required"
        });
      }

    for (const reservation of ec2Data.Reservations) {
      for (const instance of reservation.Instances) {
        const instanceId = instance.InstanceId;
        const state = instance.State.Name;
        const type = instance.InstanceType;
        const name = getInstanceName(instance);
        const zone = instance.Placement?.AvailabilityZone;

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
        const latestCpuPoint = cpuSeries.at(-1);

        result.push({
          id: instanceId,
          name,
          state,
          type,
          zone,
          cpuPercent: getLastMetricValue(cpuData.Datapoints, "Average"),
          memoryPercent: getLastMetricValue(memoryData.Datapoints, "Average"),
          networkInBytes: getLastMetricValue(netInData.Datapoints, "Sum"),
          networkOutBytes: getLastMetricValue(netOutData.Datapoints, "Sum"),
          diskReadOps: getLastMetricValue(diskReadData.Datapoints, "Sum"),
          diskWriteOps: getLastMetricValue(diskWriteData.Datapoints, "Sum"),
          cpuSeries,
          updatedAt: latestCpuPoint?.timestamp ?? responseTimestamp,
        });
      }

    res.status(200).json({
      timestamp: responseTimestamp,
      region: AWS.config.region,
      instances: result,
    });
  } catch (error) {
    next(error);
  }
});

    } catch (error) {
      return next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Route was not found" });
  });

  app.use((err, req, res, next) => {
    console.error("Backend Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message
    });
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