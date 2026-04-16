# S3 Bucket List Retrieval (Sprint 4)

## Objective
Retrieve list of S3 buckets using AWS S3 API.

## Command Used
aws s3api list-buckets --region us-east-2 --query "Buckets[].{Name:Name,Created:CreationDate}" --output table

## Steps Performed
- Retrieved bucket list using S3 API.
- Verified bucket name and creation date.
- Confirmed IAM read-only permissions are functioning correctly.

## Result
Successfully retrieved S3 bucket list via S3 API.
