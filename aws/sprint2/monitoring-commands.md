Monitoring Validation 

Region:
us-east-2

Instances:
- i-0bb4e6b6787d754c4 (apache-web-server)
- i-0f0e251f85548b8c8 (mysql-db-server)

VM STATUS (EC2 List)

# List only running instances with name, state, public IP, AZ
$REGION="us-east-2"
aws ec2 describe-instances --region $REGION --filters "Name=instance-state-name,Values=running" `
--query "Reservations[].Instances[].{ID:InstanceId,Name:Tags[?Key=='Name']|[0].Value,State:State.Name,PublicIP:PublicIpAddress,AZ:Placement.AvailabilityZone}" --output table

CPU METRIC CHECK (CloudWatch)

# CPU Utilization for 1 instance (last 1 hour)
$ID="i-0bb4e6b6787d754c4"
$END=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$START=(Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization `
--dimensions Name=InstanceId,Value=$ID --start-time $START --end-time $END --period 300 --statistics Average --region $REGION --output table

NETWORK METRICS CHECK

# NetworkIn
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkIn `
--dimensions Name=InstanceId,Value=$ID --start-time $START --end-time $END --period 300 --statistics Sum --region $REGION --output table

# NetworkOut
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkOut `
--dimensions Name=InstanceId,Value=$ID --start-time $START --end-time $END --period 300 --statistics Sum --region $REGION --output table


DISK METRICS CHECK

DISK METRICS CHECK

# DiskReadOps
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskReadOps `
--dimensions Name=InstanceId,Value=$ID --start-time $START --end-time $END --period 300 --statistics Sum --region $REGION --output table

# DiskWriteOps
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskWriteOps `
--dimensions Name=InstanceId,Value=$ID --start-time $START --end-time $END --period 300 --statistics Sum --region $REGION --output table


# Check if memory metrics exist
aws cloudwatch list-metrics --namespace CWAgent --metric-name mem_used_percent `
--dimensions Name=InstanceId,Value=i-0bb4e6b6787d754c4 --region us-east-2




