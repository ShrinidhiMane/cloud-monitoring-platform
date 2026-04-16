import express from "express";
import cors from "cors";
import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

AWS.config.update({ region: process.env.AWS_REGION || "us-east-2" });

const POWER_ACTIONS = new Set(["start", "stop"]);

const createAwsClients = () => ({
  ec2: new AWS.EC2(),
  s3: new AWS.S3()
});

const validateRule = (rule) => {
  const ipRanges = (rule.IpRanges || []).map(ip => ip.CidrIp);

  return {
    protocol: rule.IpProtocol || "unknown",
    fromPort: rule.FromPort ?? "all",
    toPort: rule.ToPort ?? "all",
    isValidPortRange:
      rule.FromPort !== undefined &&
      rule.ToPort !== undefined &&
      rule.FromPort <= rule.ToPort,
    ipRanges,
    isPublic: ipRanges.includes("0.0.0.0/0"),
    isSSHOpenToWorld:
      rule.FromPort === 22 && ipRanges.includes("0.0.0.0/0"),
    isAllTrafficOpen:
      rule.IpProtocol === "-1" && ipRanges.includes("0.0.0.0/0")
  };
};

const classifyRisk = (rules) => {
  let hasPublic = false;

  for (const rule of rules) {
    if (rule.isSSHOpenToWorld || rule.isAllTrafficOpen) return "HIGH";
    if (rule.isPublic) hasPublic = true;
  }

  return hasPublic ? "MEDIUM" : "LOW";
};

export const createApp = (clients = createAwsClients()) => {
  const { ec2, s3 } = clients;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    res.send("Server working properly");
  });

  app.get("/monitoring", async (req, res, next) => {
    console.log("Monitoring HIT");

    try {
      let securityGroupsData = [];
      let s3FilesData = [];

      try {
        const sgData = await ec2.describeSecurityGroups().promise();

        securityGroupsData = sgData.SecurityGroups.map(sg => {
          const inbound = (sg.IpPermissions || []).map(validateRule);
          const outbound = (sg.IpPermissionsEgress || []).map(validateRule);

          return {
            groupId: sg.GroupId,
            groupName: sg.GroupName,
            description: sg.Description,
            inboundRules: inbound,
            outboundRules: outbound,
            riskLevel: classifyRisk([...inbound, ...outbound])
          };
        });
      } catch (err) {
        console.error("EC2 ERROR:", err.message);

        securityGroupsData = [
          {
            groupId: "sg-mock",
            groupName: "mock-group",
            inboundRules: [],
            outboundRules: [],
            riskLevel: "LOW"
          }
        ];
      }

      try {
        if (!process.env.S3_BUCKET) {
          throw new Error("S3_BUCKET not set in .env");
        }

        const s3Data = await s3.listObjectsV2({
          Bucket: process.env.S3_BUCKET
        }).promise();

        s3FilesData = (s3Data.Contents || []).map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified
        }));
      } catch (err) {
        console.error("S3 ERROR:", err.message);

        s3FilesData = [
          {
            key: "mock-file",
            size: 0,
            lastModified: new Date()
          }
        ];
      }

      res.status(200).json({
        timestamp: new Date().toISOString(),
        region: AWS.config.region,
        securityGroups: securityGroupsData,
        s3Files: s3FilesData,
        fileCount: s3FilesData.length
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

      if (!POWER_ACTIONS.has(action)) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Body field must be 'start' or 'stop'"
        });
      }

      const request = { InstanceIds: [instanceId] };

      if (action === "start") {
        await ec2.startInstances(request).promise();
      } else {
        await ec2.stopInstances(request).promise();
      }

      res.status(200).json({
        instanceId,
        action,
        status: "accepted"
      });

    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  app.use((err, req, res, next) => {
    console.error("Backend Error:", err.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message
    });
  });

  return app;
};

const PORT = 5001;

if (process.env.NODE_ENV !== "test") {
  console.log("Starting server...");

  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}