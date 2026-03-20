# Sprint 4 Monitoring 

## Overview

This  implements a unified cloud monitoring solution that integrates multiple AWS services into a single structured output.

## Components

### 1. EC2 Monitoring
- API: `aws ec2 describe-instances`
- Retrieves:
  - Instance metadata (ID, type, state, IP)
  - Network configuration (Subnet, VPC, ENI, Security Groups)

### 2. CloudWatch Metrics (EC2)
- Namespace: `AWS/EC2`
- Metrics collected:
  - CPUUtilization
  - NetworkIn / NetworkOut
  - DiskReadOps / DiskWriteOps

### 3. CloudWatch Agent (Memory)
- Namespace: `CWAgent`
- Metric:
  - `mem_used_percent`

### 4. S3 Monitoring
- Namespace: `AWS/S3`
- Metrics:
  - BucketSizeBytes
  - NumberOfObjects
- Note: Metrics are updated once per day

## Data Flow

1. Script retrieves EC2 metadata via EC2 API
2. Fetches performance metrics from CloudWatch
3. Retrieves S3 storage metrics
4. Aggregates all data into a unified JSON structure

