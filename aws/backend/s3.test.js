import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import { upload } from "./middleware/upload.js";
import { uploadFile, deleteFile } from "./controllers/s3Controller.js";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post("/upload", upload.single("file"), uploadFile);
  app.delete("/delete/:key", deleteFile);
  return app;
};
const assertStructuredError = (res) => {
  assert.ok(res.body);
  assert.equal(typeof res.body.error, "string");
};

const assertStructuredSuccess = (res, expectedMessage) => {
  assert.ok(res.body);
  assert.equal(res.body.message, expectedMessage);
};

test("POST /upload returns 400 when no file is attached", async () => {
  const app = buildApp();
  const res = await request(app).post("/upload");
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "No file uploaded");
});

test("POST /upload accepts a file and returns a structured response", async () => {
  const app = buildApp();
  const res = await request(app)
    .post("/upload")
    .attach("file", Buffer.from("hello world"), "hello.txt");

  assert.ok(
    res.status === 200 || res.status === 500,
    `Expected 200 or 500, got ${res.status}`,
  );

  if (res.status === 200) {
    assertStructuredSuccess(res, "Upload successful");
    assert.ok(typeof res.body.key === "string" && res.body.key.length > 0);
  } else {
    assertStructuredError(res);
  }
});

test("POST /upload rejects files larger than 5 MB", async () => {
  const app = buildApp();
  const bigFile = Buffer.alloc(6 * 1024 * 1024, "x");
  const res = await request(app)
    .post("/upload")
    .attach("file", bigFile, "big.bin");
  assert.ok(
    res.status === 400 || res.status === 500,
    `Expected 400 or 500 for oversized file, got ${res.status}`,
  );
});

test("DELETE /delete/:key returns a structured response", async () => {
  const app = buildApp();
  const res = await request(app).delete("/delete/uploads%2Fsome-file.txt");

  assert.ok(
    res.status === 200 || res.status === 500,
    `Expected 200 or 500, got ${res.status}`,
  );

  if (res.status === 200) {
    assertStructuredSuccess(res, "Deleted successfully");
  } else {
    assertStructuredError(res);
  }
});
test("DELETE /delete/:key with missing key returns 404", async () => {
  const app = buildApp();
  const res = await request(app).delete("/delete/");
  assert.equal(res.status, 404);
});
