param(
  [string]$REGION = "us-east-2",
  [int]$Minutes = 60,
  [string]$StartTime = "",
  [string]$EndTime = "",
  [string]$BucketName = "ser517-monitoring-bucket-team5"
)

$InstanceIds = @("i-0f0e251f85548b8c8","i-0bb4e6b6787d754c4")

[datetime]$endTimeUtc = Get-Date
$endTimeUtc = $endTimeUtc.ToUniversalTime()

if (-not [string]::IsNullOrWhiteSpace($EndTime)) {
  $endTimeUtc = [datetime]::Parse($EndTime).ToUniversalTime()
}

[datetime]$startTimeUtc = $endTimeUtc.AddMinutes(-1 * $Minutes)

if (-not [string]::IsNullOrWhiteSpace($StartTime)) {
  $startTimeUtc = [datetime]::Parse($StartTime).ToUniversalTime()
}

$EndTimeString   = $endTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
$StartTimeString = $startTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")

$timeRangeSeconds = [int]((New-TimeSpan -Start $startTimeUtc -End $endTimeUtc).TotalSeconds)

if ($timeRangeSeconds -le 21600) {
  $PeriodSeconds = 300
} elseif ($timeRangeSeconds -le 172800) {
  $PeriodSeconds = 900
} else {
  $PeriodSeconds = 3600
}

$instancesResult = @()

foreach($instanceId in $InstanceIds){

  $instanceResponse = aws ec2 describe-instances --instance-ids $instanceId --region $REGION --output json | ConvertFrom-Json
  $instanceData = $instanceResponse.Reservations[0].Instances[0]

  $instanceName = ($instanceData.Tags | Where-Object { $_.Key -eq "Name" } | Select-Object -First 1).Value
  $instanceState = $instanceData.State.Name
  $instanceType = $instanceData.InstanceType
  $publicIpAddress = $instanceData.PublicIpAddress
  $imageId = $instanceData.ImageId

  $subnetId = $instanceData.SubnetId
  $vpcId    = $instanceData.VpcId

  $networkInterfaceIds = @(
    $instanceData.NetworkInterfaces | ForEach-Object { $_.NetworkInterfaceId }
  )

  $securityGroupIds = @(
    $instanceData.SecurityGroups | ForEach-Object { $_.GroupId }
  )

  # CPU
  $cpuMetrics = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization `
    --dimensions Name=InstanceId,Value=$instanceId --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Average --region $REGION --output json | ConvertFrom-Json

  # Network
  $networkInMetrics = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkIn `
    --dimensions Name=InstanceId,Value=$instanceId --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $networkOutMetrics = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkOut `
    --dimensions Name=InstanceId,Value=$instanceId --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Sum --region $REGION --output json | ConvertFrom-Json

  # Disk
  $diskReadMetrics = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskReadOps `
    --dimensions Name=InstanceId,Value=$instanceId --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $diskWriteMetrics = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskWriteOps `
    --dimensions Name=InstanceId,Value=$instanceId --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Sum --region $REGION --output json | ConvertFrom-Json

  # Memory
  $memoryMetrics = aws cloudwatch get-metric-statistics --namespace CWAgent --metric-name mem_used_percent `
    --dimensions Name=InstanceId,Value=$instanceId Name=ImageId,Value=$imageId Name=InstanceType,Value=$instanceType `
    --start-time $StartTimeString --end-time $EndTimeString --period $PeriodSeconds --statistics Average --region $REGION --output json | ConvertFrom-Json

  $cpuPercent = if($cpuMetrics.Datapoints.Count -gt 0){
    [math]::Round([double](($cpuMetrics.Datapoints | Sort-Object Timestamp)[-1].Average), 2)
  } else { 0 }

  $networkInBytes = if($networkInMetrics.Datapoints.Count -gt 0){
    [double](($networkInMetrics.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $networkOutBytes = if($networkOutMetrics.Datapoints.Count -gt 0){
    [double](($networkOutMetrics.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $diskReadOps = if($diskReadMetrics.Datapoints.Count -gt 0){
    [double](($diskReadMetrics.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $diskWriteOps = if($diskWriteMetrics.Datapoints.Count -gt 0){
    [double](($diskWriteMetrics.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $memoryLatest = if($memoryMetrics.Datapoints.Count -gt 0){
    [math]::Round([double](($memoryMetrics.Datapoints | Sort-Object Timestamp)[-1].Average), 2)
  } else { $null }

  $instanceObject = [PSCustomObject]@{
    instanceId          = $instanceId
    name                = $instanceName
    state               = $instanceState
    type                = $instanceType
    publicIp            = $publicIpAddress
    subnetId            = $subnetId
    vpcId               = $vpcId
    networkInterfaceIds = $networkInterfaceIds
    securityGroupIds    = $securityGroupIds
    cpuPercent          = $cpuPercent
    networkInBytes      = $networkInBytes
    networkOutBytes     = $networkOutBytes
    diskReadOps         = $diskReadOps
    diskWriteOps        = $diskWriteOps
    memoryLatest        = $memoryLatest
    startTimeUtc        = $StartTimeString
    endTimeUtc          = $EndTimeString
    periodSeconds       = $PeriodSeconds
  }

  $instancesResult += $instanceObject
}

# S3 Metrics
$s3SizeMetrics = aws cloudwatch get-metric-statistics `
  --namespace AWS/S3 `
  --metric-name BucketSizeBytes `
  --dimensions Name=BucketName,Value=$BucketName Name=StorageType,Value=StandardStorage `
  --start-time $StartTimeString `
  --end-time $EndTimeString `
  --period 86400 `
  --statistics Average `
  --region $REGION `
  --output json | ConvertFrom-Json

$s3ObjectMetrics = aws cloudwatch get-metric-statistics `
  --namespace AWS/S3 `
  --metric-name NumberOfObjects `
  --dimensions Name=BucketName,Value=$BucketName Name=StorageType,Value=AllStorageTypes `
  --start-time $StartTimeString `
  --end-time $EndTimeString `
  --period 86400 `
  --statistics Average `
  --region $REGION `
  --output json | ConvertFrom-Json

$bucketSizeBytes = if($s3SizeMetrics.Datapoints.Count -gt 0){
  ($s3SizeMetrics.Datapoints | Sort-Object Timestamp)[-1].Average
} else { 0 }

$numberOfObjects = if($s3ObjectMetrics.Datapoints.Count -gt 0){
  ($s3ObjectMetrics.Datapoints | Sort-Object Timestamp)[-1].Average
} else { 0 }

$outputObject = [PSCustomObject]@{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  region    = $REGION
  instances = $instancesResult
  s3        = [PSCustomObject]@{
    bucketName      = $BucketName
    bucketSizeBytes = $bucketSizeBytes
    numberOfObjects = $numberOfObjects
  }
}

$outputFilePath = Join-Path $PSScriptRoot "sprint4_monitoring.json"

$outputObject | ConvertTo-Json -Depth 8 | Out-File $outputFilePath -Encoding utf8

Write-Output "Saved $outputFilePath"