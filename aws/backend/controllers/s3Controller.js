import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

export const uploadFile = async (req, res) => {
  try {
    console.log("Request received");

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File detected:", req.file.originalname);

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    console.log("Sending to S3...");

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    console.log("Upload completed");

    res.json({ message: "Upload successful", key });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { key } = req.params;

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
      })
    );

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
