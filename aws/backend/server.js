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

const getLatestMetric = (data, field) => {
  if (!data.Datapoints || data.Datapoints.length === 0) return 0;
  const sorted = data.Datapoints.sort(
    (a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)
  );
  return sorted.at(-1)[field] || 0;
};

app.get("/monitoring", async (req, res, next) => {
  try {
    const instances = [];
    const s3Buckets = [];

    const ec2Data = await ec2.describeInstances({
      Filters: [{ Name: "instance-state-name", Values: ["running"] }]
    }).promise();

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

    if (ec2Data.Reservations.length) {
      for (const reservation of ec2Data.Reservations) {
        for (const instance of reservation.Instances) {
          const instanceId = instance.InstanceId;

          const [
            cpuData,
            netInData,
            netOutData,
            diskReadData,
            diskWriteData,
            memoryData
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
            }).promise(),

            cloudwatch.getMetricStatistics({
              Namespace: "CWAgent",
              MetricName: "mem_used_percent",
              Dimensions: [
                { Name: "InstanceId", Value: instanceId },
                { Name: "ImageId", Value: instance.ImageId },
                { Name: "InstanceType", Value: instance.InstanceType }
              ],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ["Average"]
            }).promise()
          ]);

          instances.push({
            instanceId,
            state: instance.State.Name,
            type: instance.InstanceType,
            network: {
              privateIP: instance.PrivateIpAddress || null,
              publicIP: instance.PublicIpAddress || null,
              subnetId: instance.SubnetId || null,
              vpcId: instance.VpcId || null,
              securityGroups: instance.SecurityGroups.map(g => g.GroupName)
            },
            metrics: {
              cpuUtilization: Number(getLatestMetric(cpuData, "Average").toFixed(2)),
              memoryUtilization: Number(getLatestMetric(memoryData, "Average").toFixed(2)),
              networkInBytes: getLatestMetric(netInData, "Sum"),
              networkOutBytes: getLatestMetric(netOutData, "Sum"),
              diskReadOps: getLatestMetric(diskReadData, "Sum"),
              diskWriteOps: getLatestMetric(diskWriteData, "Sum")
            }
          });
        }
      }
    }

    const bucketList = await s3.listBuckets().promise();

    for (const bucket of bucketList.Buckets) {
      try {
        const s3End = new Date();
        const s3Start = new Date(s3End.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [sizeData, objectData] = await Promise.all([
          cloudwatch.getMetricStatistics({
            Namespace: "AWS/S3",
            MetricName: "BucketSizeBytes",
            Dimensions: [
              { Name: "BucketName", Value: bucket.Name },
              { Name: "StorageType", Value: "StandardStorage" }
            ],
            StartTime: s3Start,
            EndTime: s3End,
            Period: 86400,
            Statistics: ["Average"]
          }).promise(),

          cloudwatch.getMetricStatistics({
            Namespace: "AWS/S3",
            MetricName: "NumberOfObjects",
            Dimensions: [
              { Name: "BucketName", Value: bucket.Name },
              { Name: "StorageType", Value: "AllStorageTypes" }
            ],
            StartTime: s3Start,
            EndTime: s3End,
            Period: 86400,
            Statistics: ["Average"]
          }).promise()
        ]);

        let encryptionEnabled = false;
        try {
          await s3.getBucketEncryption({ Bucket: bucket.Name }).promise();
          encryptionEnabled = true;
        } catch (err) {}

        let publicAccessBlocked = false;
        try {
          const publicAccess = await s3.getPublicAccessBlock({ Bucket: bucket.Name }).promise();
          publicAccessBlocked =
            publicAccess.PublicAccessBlockConfiguration.BlockPublicAcls &&
            publicAccess.PublicAccessBlockConfiguration.BlockPublicPolicy &&
            publicAccess.PublicAccessBlockConfiguration.IgnorePublicAcls &&
            publicAccess.PublicAccessBlockConfiguration.RestrictPublicBuckets;
        } catch (err) {}

        s3Buckets.push({
          bucketName: bucket.Name,
          bucketSizeBytes: getLatestMetric(sizeData, "Average"),
          numberOfObjects: getLatestMetric(objectData, "Average"),
          encryptionEnabled,
          publicAccessBlocked
        });

      } catch (err) {
        console.error("S3 monitoring error:", err.message);
      }
    }

    const sgData = await ec2.describeSecurityGroups().promise();

    res.status(200).json({
      timestamp: new Date().toISOString(),
      region: AWS.config.region,
      instances,
      s3: s3Buckets,
      security: sgData.SecurityGroups.map(sg => ({
        groupId: sg.GroupId,
        groupName: sg.GroupName,
        description: sg.Description
      }))
    });

  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Backend Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });
});

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
