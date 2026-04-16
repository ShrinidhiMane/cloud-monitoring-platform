# Retrieve MemoryUtilization via CloudWatch API (Sprint 3)

## Objective
Retrieve memory utilization (mem_used_percent) metric using CloudWatch Open API.

## Command Used
aws cloudwatch get-metric-statistics --region us-east-2 --namespace CWAgent --metric-name mem_used_percent --dimensions Name=InstanceId,Value=i-0bb4e6b6787d754c4 Name=ImageId,Value=ami-05efc83cb5512477c Name=InstanceType,Value=t3.micro --statistics Average --period 300 --start-time 2026-03-05T00:00:00Z --end-time 2026-03-06T23:59:00Z --output table

## Result
Successfully retrieved memory utilization percentage from CloudWatch Agent metrics for the EC2 instance.
