# Cloudwatch Agent Setup (Sprint 3)

## Objective
Install and configure CloudWatch Agent on EC2 instance to enable memory monitoring.

## Steps Performed
-Installed CloudWatch Agent on EC2 instance.
-Ran CloudWatch Agent configuration wizard.
-Enabled memory metric (mem_used_percent).
-Selected 60-second metric collection interval.
-Attached CloudWatchAgentServerPolicy to EC2CloudMonitorRole.
-Stopped and restarted EC2 instance to refresh IAM credentials.
-Restarted CloudWatch Agent service.
-Verified CWAgent namespace creation in CloudWatch Console.

## Result
CloudWatch Agent successfully configured.
Memory metric (mem_used_percent) is now being published to CloudWatch under the CWAgent namespace.
