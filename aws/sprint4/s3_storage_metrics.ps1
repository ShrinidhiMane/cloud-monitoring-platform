$REGION = "us-east-2"
$bucketName = "ser517-monitoring-bucket-team5"

$START_STR = "2026-03-16T00:00:00Z"
$END_STR   = "2026-03-20T00:00:00Z"

$s3Size = aws cloudwatch get-metric-statistics `
  --namespace AWS/S3 `
  --metric-name BucketSizeBytes `
  --dimensions Name=BucketName,Value=$bucketName Name=StorageType,Value=StandardStorage `
  --start-time $START_STR `
  --end-time $END_STR `
  --period 86400 `
  --statistics Average `
  --region $REGION `
  --output json | ConvertFrom-Json

$s3Objects = aws cloudwatch get-metric-statistics `
  --namespace AWS/S3 `
  --metric-name NumberOfObjects `
  --dimensions Name=BucketName,Value=$bucketName Name=StorageType,Value=AllStorageTypes `
  --start-time $START_STR `
  --end-time $END_STR `
  --period 86400 `
  --statistics Average `
  --region $REGION `
  --output json | ConvertFrom-Json

$bucketSize = if ($s3Size.Datapoints.Count -gt 0) {
  ($s3Size.Datapoints | Sort-Object { [datetime]$_.Timestamp })[-1].Average
} else { 0 }

$objectCount = if ($s3Objects.Datapoints.Count -gt 0) {
  ($s3Objects.Datapoints | Sort-Object { [datetime]$_.Timestamp })[-1].Average
} else { 0 }

$result = @{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  region = $REGION
  s3 = @{
    bucketName = $bucketName
    bucketSizeBytes = $bucketSize
    numberOfObjects = $objectCount
  }
}

$result | ConvertTo-Json -Depth 5