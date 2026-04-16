param(
  [string]$REGION = "us-east-2",

  [int]$Minutes = 60,

  [string]$StartTime = "",
  [string]$EndTime = ""
)

$IDS = @("i-0f0e251f85548b8c8","i-0bb4e6b6787d754c4")

[datetime]$endDt = Get-Date
$endDt = $endDt.ToUniversalTime()

if (-not [string]::IsNullOrWhiteSpace($EndTime)) {
  $endDt = [datetime]::Parse($EndTime).ToUniversalTime()
}

[datetime]$startDt = $endDt.AddMinutes(-1 * $Minutes)

if (-not [string]::IsNullOrWhiteSpace($StartTime)) {
  $startDt = [datetime]::Parse($StartTime).ToUniversalTime()
}

$END_STR   = $endDt.ToString("yyyy-MM-ddTHH:mm:ssZ")
$START_STR = $startDt.ToString("yyyy-MM-ddTHH:mm:ssZ")

$rangeSeconds = [int]((New-TimeSpan -Start $startDt -End $endDt).TotalSeconds)

if ($rangeSeconds -le 21600) {
  $PERIOD = 300
} elseif ($rangeSeconds -le 172800) {
  $PERIOD = 900
} else {
  $PERIOD = 3600
}

Write-Output "Region: $REGION"
Write-Output "Start:  $START_STR"
Write-Output "End:    $END_STR"
Write-Output "Period: $PERIOD seconds"
Write-Output ""

$result = @()

foreach($id in $IDS){

  $inst = aws ec2 describe-instances --instance-ids $id --region $REGION --output json | ConvertFrom-Json

  $name     = ($inst.Reservations[0].Instances[0].Tags | Where-Object { $_.Key -eq "Name" } | Select-Object -First 1).Value
  $publicIp = $inst.Reservations[0].Instances[0].PublicIpAddress
  $state    = $inst.Reservations[0].Instances[0].State.Name
  $type     = $inst.Reservations[0].Instances[0].InstanceType

  $imageId       = $inst.Reservations[0].Instances[0].ImageId
  $instanceType  = $type

  # CPU
  $cpu = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Average --region $REGION --output json | ConvertFrom-Json

  # Network
  $netin = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkIn `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $netout = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkOut `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $dread = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskReadOps `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $dwrite = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskWriteOps `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $mem = aws cloudwatch get-metric-statistics --namespace CWAgent --metric-name mem_used_percent `
    --dimensions Name=InstanceId,Value=$id Name=ImageId,Value=$imageId Name=InstanceType,Value=$instanceType `
    --start-time $START_STR --end-time $END_STR --period $PERIOD --statistics Average --region $REGION --output json | ConvertFrom-Json

  $memoryLatest = if($mem.Datapoints.Count -gt 0){
    [math]::Round([double](($mem.Datapoints | Sort-Object Timestamp)[-1].Average), 2)
  } else { $null }

  $memoryDatapoints = @()
  if ($mem.Datapoints.Count -gt 0) {
    $memoryDatapoints = $mem.Datapoints |
      Sort-Object Timestamp |
      ForEach-Object {
        [PSCustomObject]@{
          timestamp = ([datetime]$_.Timestamp).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
          value     = [math]::Round([double]$_.Average, 2)
        }
      }
  }

  $cpuPercent = if($cpu.Datapoints.Count -gt 0){
    [math]::Round([double](($cpu.Datapoints | Sort-Object Timestamp)[-1].Average), 2)
  } else { 0 }

  $networkInBytes = if($netin.Datapoints.Count -gt 0){
    [double](($netin.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $networkOutBytes = if($netout.Datapoints.Count -gt 0){
    [double](($netout.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $diskReadOps = if($dread.Datapoints.Count -gt 0){
    [double](($dread.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $diskWriteOps = if($dwrite.Datapoints.Count -gt 0){
    [double](($dwrite.Datapoints | Sort-Object Timestamp)[-1].Sum)
  } else { 0 }

  $r = [PSCustomObject]@{
    id              = $id
    state           = $state
    type            = $type
    name            = $name
    publicIp        = $publicIp

    cpuPercent      = $cpuPercent
    networkInBytes  = $networkInBytes
    networkOutBytes = $networkOutBytes
    diskReadOps     = $diskReadOps
    diskWriteOps    = $diskWriteOps

    
    memoryLatest     = $memoryLatest
    memoryDatapoints = $memoryDatapoints
    startTimeUtc     = $START_STR
    endTimeUtc       = $END_STR
    periodSeconds    = $PERIOD
  }

  $result += $r
}

$out = [PSCustomObject]@{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  region    = $REGION
  instances = $result
}

$outFile = "instances_metrics.json"
$out | ConvertTo-Json -Depth 8 | Out-File $outFile -Encoding utf8
Write-Output "Saved $outFile"