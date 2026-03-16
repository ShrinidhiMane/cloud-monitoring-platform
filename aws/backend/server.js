const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");

const app = express();
app.use(cors());
app.use(express.json());

AWS.config.update({ region: "us-east-2" });

const ec2 = new AWS.EC2();
const cloudwatch = new AWS.CloudWatch();

app.get("/monitoring", async (req, res, next) => {
  try {
    const result = [];

    const ec2Data = await ec2
      .describeInstances({
        Filters: [{ Name: "instance-state-name", Values: ["running"] }],
      })
      .promise();

    if (!ec2Data.Reservations.length) {
      return res.json({
        timestamp: new Date().toISOString(),
        region: AWS.config.region,
        instances: [],
      });
    }

    for (const reservation of ec2Data.Reservations) {
      for (const instance of reservation.Instances) {
        const instanceId = instance.InstanceId;

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
          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "CPUUtilization",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Average"],
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "NetworkIn",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"],
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "NetworkOut",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"],
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "DiskReadOps",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"],
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "DiskWriteOps",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"],
          }).promise(),

          cloudwatch.getMetricStatistics({
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
          }).promise(),
        ]);

        const getLatest = (data, field) => {
          if (!data.Datapoints.length) return 0;
          const sorted = data.Datapoints.sort(
            (a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)
          );
          return sorted.at(-1)[field] || 0;
        };

        result.push({
          instanceId,
          state: instance.State.Name,
          type: instance.InstanceType,
          metrics: {
            cpuUtilization: Number(getLatest(cpuData, "Average").toFixed(2)),
            memoryUtilization: Number(getLatest(memoryData, "Average").toFixed(2)),
            networkInBytes: getLatest(netInData, "Sum"),
            networkOutBytes: getLatest(netOutData, "Sum"),
            diskReadOps: getLatest(diskReadData, "Sum"),
            diskWriteOps: getLatest(diskWriteData, "Sum"),
          },
        });
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      region: AWS.config.region,
      instances: result,
    });

  } catch (error) {
    next(error);
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

const PORT = 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
