import express from "express";
import cors from "cors";
import AWS from "aws-sdk";

AWS.config.update({ region: "us-east-2" });

const POWER_ACTIONS = new Set(["start", "stop"]);

const createAwsClients = () => ({
  ec2: new AWS.EC2()
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

export const createApp = (clients = createAwsClients()) => {
  const { ec2 } = clients;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    console.log("ROOT HIT");
    res.send("Server working properly");
  });

  app.get("/monitoring", async (req, res, next) => {
    try {
      console.log("Monitoring HIT");

      let securityGroupsData = [];

      try {
        const sgData = await ec2.describeSecurityGroups().promise();

        securityGroupsData = sgData.SecurityGroups.map(sg => ({
          groupId: sg.GroupId,
          groupName: sg.GroupName,
          description: sg.Description,
          inboundRules: (sg.IpPermissions || []).map(rule => validateRule(rule)),
          outboundRules: (sg.IpPermissionsEgress || []).map(rule => validateRule(rule))
        }));

      } catch (err) {
        console.error("Security Groups Error:", err.message);

        securityGroupsData = [
          {
            groupId: "sg-mock",
            groupName: "mock-group",
            inboundRules: [],
            outboundRules: []
          }
        ];
      }

      res.status(200).json({
        timestamp: new Date().toISOString(),
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

      if (!POWER_ACTIONS.has(action)) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Body field 'action' must be either 'start' or 'stop'"
        });
      }

      const request = { InstanceIds: [instanceId] };
      const response = action === "start"
        ? await ec2.startInstances(request).promise()
        : await ec2.stopInstances(request).promise();

      return res.status(200).json({
        instanceId,
        action,
        status: "accepted"
      });

    } catch (error) {
      return next(error);
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

  return app;
};
const PORT = 5000;

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}