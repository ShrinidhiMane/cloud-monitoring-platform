import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./server.js";

const wrapResult = (value) => ({
  promise: async () => value
});

const wrapError = (error) => ({
  promise: async () => {
    throw error;
  }
});

const buildClients = (overrides = {}) => {
  const metricData = {
    CPUUtilization: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Average: 12.34 }]
    },
    NetworkIn: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Sum: 1200 }]
    },
    NetworkOut: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Sum: 2400 }]
    },
    DiskReadOps: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Sum: 11 }]
    },
    DiskWriteOps: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Sum: 22 }]
    },
    mem_used_percent: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Average: 45.67 }]
    },
    BucketSizeBytes: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Average: 4096 }]
    },
    NumberOfObjects: {
      Datapoints: [{ Timestamp: "2026-03-27T12:00:00.000Z", Average: 10 }]
    }
  };

  const ec2 = {
    describeInstances: () => wrapResult({
      Reservations: [{
        Instances: [{
          InstanceId: "i-1234567890",
          State: { Name: "running" },
          InstanceType: "t3.micro",
          PrivateIpAddress: "10.0.0.10",
          PublicIpAddress: "54.0.0.10",
          SubnetId: "subnet-1",
          VpcId: "vpc-1",
          ImageId: "ami-1",
          SecurityGroups: [{ GroupName: "default" }]
        }]
      }]
    }),
    describeSecurityGroups: () => wrapResult({
      SecurityGroups: [{
        GroupId: "sg-1",
        GroupName: "default",
        Description: "default security group"
      }]
    }),
    startInstances: () => wrapResult({
      StartingInstances: [{
        InstanceId: "i-1234567890",
        PreviousState: { Name: "stopped" },
        CurrentState: { Name: "pending" }
      }],
      $response: { requestId: "req-start" }
    }),
    stopInstances: () => wrapResult({
      StoppingInstances: [{
        InstanceId: "i-1234567890",
        PreviousState: { Name: "running" },
        CurrentState: { Name: "stopping" }
      }],
      $response: { requestId: "req-stop" }
    })
  };

  const cloudwatch = {
    getMetricStatistics: ({ MetricName }) => wrapResult(metricData[MetricName] || { Datapoints: [] })
  };

  const s3 = {
    listBuckets: () => wrapResult({ Buckets: [{ Name: "team-bucket" }] }),
    getBucketEncryption: () => wrapResult({}),
    getPublicAccessBlock: () => wrapResult({
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    })
  };

  return {
    ec2,
    cloudwatch,
    s3,
    ...overrides
  };
};

test("GET /monitoring returns aggregated EC2 and S3 data", async () => {
  const app = createApp(buildClients());

  const response = await request(app).get("/monitoring");

  assert.equal(response.status, 200);
  assert.equal(response.body.region, "us-east-2");
  assert.equal(response.body.instances.length, 1);
  assert.equal(response.body.s3.length, 1);
  assert.equal(response.body.security.length, 1);
  assert.equal(response.body.instances[0].instanceId, "i-1234567890");
  assert.equal(response.body.instances[0].metrics.cpuUtilization, 12.34);
  assert.equal(response.body.instances[0].metrics.memoryUtilization, 45.67);
  assert.equal(response.body.s3[0].bucketName, "team-bucket");
  assert.equal(response.body.s3[0].encryptionEnabled, true);
  assert.equal(response.body.s3[0].publicAccessBlocked, true);
});

test("POST /instances/:instanceId/power validates action", async () => {
  const app = createApp(buildClients());

  const response = await request(app)
    .post("/instances/i-1234567890/power")
    .send({ action: "reboot" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "ValidationError");
});

test("POST /instances/:instanceId/power start returns transition details", async () => {
  const app = createApp(buildClients());

  const response = await request(app)
    .post("/instances/i-1234567890/power")
    .send({ action: "start" });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "accepted");
  assert.equal(response.body.previousState, "stopped");
  assert.equal(response.body.currentState, "pending");
  assert.equal(response.body.requestId, "req-start");
});

test("POST /instances/:instanceId/power maps not found errors to 404", async () => {
  const app = createApp(buildClients({
    ec2: {
      ...buildClients().ec2,
      startInstances: () => wrapError({
        code: "InvalidInstanceID.NotFound",
        message: "The instance ID does not exist"
      })
    }
  }));

  const response = await request(app)
    .post("/instances/i-does-not-exist/power")
    .send({ action: "start" });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "InvalidInstanceID.NotFound");
});

test("POST /instances/:instanceId/power maps incorrect state errors to 409", async () => {
  const app = createApp(buildClients({
    ec2: {
      ...buildClients().ec2,
      stopInstances: () => wrapError({
        code: "IncorrectInstanceState",
        message: "Instance cannot be stopped from current state"
      })
    }
  }));

  const response = await request(app)
    .post("/instances/i-1234567890/power")
    .send({ action: "stop" });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "IncorrectInstanceState");
});

test("unknown routes return 404", async () => {
  const app = createApp(buildClients());

  const response = await request(app).get("/does-not-exist");

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Route not found");
});
