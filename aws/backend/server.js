import express from "express";
import cors from "cors";
import AWS from "aws-sdk";

const app = express();
app.use(cors());
app.use(express.json());

AWS.config.update({ region: "us-east-2" });

const ec2 = new AWS.EC2();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();

app.get("/monitoring", async (req, res, next) => {
  try {
    console.log("Monitoring endpoint hit");

    const instances = [];

    const ec2Data = await ec2
      .describeInstances({
        Filters: [{ Name: "instance-state-name", Values: ["running"] }]
      })
      .promise();

    if (!ec2Data.Reservations.length) {
      const sgData = await ec2.describeSecurityGroups().promise();

      return res.status(200).json({
        timestamp: new Date().toISOString(),
        region: AWS.config.region,
        instances: [],
        s3: [],
        security: sgData.SecurityGroups.map(sg => ({
          groupId: sg.GroupId,
          groupName: sg.GroupName,
          description: sg.Description
        }))
      });
    }

    for (const reservation of ec2Data.Reservations) {
      for (const instance of reservation.Instances) {
        const instanceId = instance.InstanceId;
        const state = instance.State.Name;
        const type = instance.InstanceType;

        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

        const [
          cpuData,
          netInData,
          netOutData,
          diskReadData,
          diskWriteData
        ] = await Promise.all([
          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "CPUUtilization",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Average"]
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "NetworkIn",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"]
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "NetworkOut",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"]
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "DiskReadOps",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"]
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/EC2",
            MetricName: "DiskWriteOps",
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ["Sum"]
          }).promise()
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

        instances.push({
          instanceId,
          state,
          type,
          network: {
            privateIP: instance.PrivateIpAddress || null,
            publicIP: instance.PublicIpAddress || null,
            subnetId: instance.SubnetId || null,
            vpcId: instance.VpcId || null,
            securityGroups: instance.SecurityGroups.map(g => g.GroupName)
          },
          metrics: {
            cpuUtilization: Number(cpuValue.toFixed(2)),
            networkInBytes: networkIn,
            networkOutBytes: networkOut,
            diskReadOps: diskRead,
            diskWriteOps: diskWrite
          },
          memory: {
            status: "Not available (requires CloudWatch Agent)"
          }
        });
      }
    }

    const s3Buckets = [];
    const bucketList = await s3.listBuckets().promise();

    for (const bucket of bucketList.Buckets) {
      try {
        const objects = await s3.listObjectsV2({
          Bucket: bucket.Name
        }).promise();

        s3Buckets.push({
          bucketName: bucket.Name,
          objectCount: objects.KeyCount || 0
        });
      } catch (err) {
        console.error("S3 bucket read error:", err.message);
      }
    }

    const sgData = await ec2.describeSecurityGroups().promise();

    const security = sgData.SecurityGroups.map(sg => ({
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      description: sg.Description
    }));

    res.status(200).json({
      timestamp: new Date().toISOString(),
      region: AWS.config.region,
      instances,
      s3: s3Buckets,
      security
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Backend Error:", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });
});

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});