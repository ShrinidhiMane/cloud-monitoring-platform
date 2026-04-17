# EC2 Instance Control Implementation (Sprint 6)

## Objective
Implement EC2 instance start, stop, and reboot operations through backend API.

## Command Used
aws ec2 start-instances --instance-ids i-INSTANCE_ID
aws ec2 stop-instances --instance-ids i-INSTANCE_ID
aws ec2 reboot-instances --instance-ids i-INSTANCE_ID

## Steps Performed
-Implemented EC2 start, stop, and reboot operations using AWS EC2 API.
-Created backend endpoint /instances/:instanceId/power.
-Added allow-list validation using AWS_ALLOWED_INSTANCE_IDS.
-Configured IAM role for secure EC2 access.
-Deployed backend on EC2 and configured Elastic IP.
-Tested API using curl commands.

## Result
Successfully implemented EC2 control functionality and validated start, stop, and reboot operations.
