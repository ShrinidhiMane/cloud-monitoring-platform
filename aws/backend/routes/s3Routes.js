import express from "express";
import { uploadFile, deleteFile } from "../controllers/s3Controller.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post(
  "/upload",
  (req, res, next) => {
    console.log("ROUTE HIT BEFORE MULTER");
    next();
  },
  upload.single("file"),
  (req, res, next) => {
    console.log("AFTER MULTER", req.file);
    next();
  },
  uploadFile
);

router.delete("/delete/:key", deleteFile);

export default router;