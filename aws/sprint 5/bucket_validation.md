# S3 Bucket Encryption Validation (Sprint 5)

## Objective
Validate S3 bucket encryption configuration to ensure secure storage of monitoring data.

## Command Used
aws s3api get-bucket-encryption --bucket ser517-monitoring-bucket-team5 --region us-east-2 --output table

## Steps Performed
- Retrieved S3 bucket encryption configuration using AWS S3 API.
- Verified that server-side encryption is enabled.
- Confirmed encryption algorithm as AES256.
- Validated IAM permissions required for encryption retrieval.

## Result
Successfully verified S3 bucket encryption is enabled using AES256.
