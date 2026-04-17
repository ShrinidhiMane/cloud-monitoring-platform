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

test("POST /upload returns 400 when no file is provided", async () => {
  const app = buildApp();
  const response = await request(app).post("/upload");
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "No file uploaded");
});

test("DELETE /delete/:key returns 500 when AWS credentials are not configured", async () => {
  const app = buildApp();
  const response = await request(app).delete("/delete/some-key");
  assert.equal(response.status, 500);
});
