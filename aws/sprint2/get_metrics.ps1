$REGION="us-east-2"
$IDS=@("i-0f0e251f85548b8c8","i-0bb4e6b6787d754c4")  # EC2 instances

$END=(Get-Date).ToUniversalTime()
$START=(Get-Date).AddHours(-1).ToUniversalTime()

$END_STR   = $END.ToString("yyyy-MM-ddTHH:mm:ssZ")
$START_STR = $START.ToString("yyyy-MM-ddTHH:mm:ssZ")

$result = @()

foreach($id in $IDS){

  $inst = aws ec2 describe-instances --instance-ids $id --region $REGION --output json | ConvertFrom-Json
  $state = $inst.Reservations[0].Instances[0].State.Name
  $type  = $inst.Reservations[0].Instances[0].InstanceType

  # CPU
  $cpu = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period 300 --statistics Average --region $REGION --output json | ConvertFrom-Json

  # Network
  $netin = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkIn `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period 300 --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $netout = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name NetworkOut `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period 300 --statistics Sum --region $REGION --output json | ConvertFrom-Json

  
  $dread = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskReadOps `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period 300 --statistics Sum --region $REGION --output json | ConvertFrom-Json

  $dwrite = aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name DiskWriteOps `
    --dimensions Name=InstanceId,Value=$id --start-time $START_STR --end-time $END_STR --period 300 --statistics Sum --region $REGION --output json | ConvertFrom-Json



  

  # latest datapoints 

  $cpuValue = if($cpu.Datapoints.Count -gt 0){ ($cpu.Datapoints | Sort-Object Timestamp)[-1].Average } else { 0 }
  $netInVal  = if($netin.Datapoints.Count -gt 0){ ($netin.Datapoints | Sort-Object Timestamp)[-1].Sum } else { 0 }
  $netOutVal = if($netout.Datapoints.Count -gt 0){ ($netout.Datapoints | Sort-Object Timestamp)[-1].Sum } else { 0 }
  $diskRead  = if($dread.Datapoints.Count -gt 0){ ($dread.Datapoints | Sort-Object Timestamp)[-1].Sum } else { 0 }
  $diskWrite = if($dwrite.Datapoints.Count -gt 0){ ($dwrite.Datapoints | Sort-Object Timestamp)[-1].Sum } else { 0 }

  # name & public ip 
  $name     = ($inst.Reservations[0].Instances[0].Tags | Where-Object { $_.Key -eq "Name" } | Select-Object -First 1).Value
  $publicIp = $inst.Reservations[0].Instances[0].PublicIpAddress

  # produce flat object 
  $result += [PSCustomObject]@{
    id            = $id
    state         = $state
    type          = $type
    name          = $name
    publicIp      = $publicIp
    cpuPercent    = [math]::Round([double]$cpuValue,2)
    networkInBytes  = [double]$netInVal
    networkOutBytes = [double]$netOutVal
    diskReadOps     = if ($diskRead -eq 0) { 0 } else { [double]$diskRead }
    diskWriteOps    = if ($diskWrite -eq 0){ 0 } else { [double]$diskWrite }
  }
}



# final output 

$out = [PSCustomObject]@{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  region    = $REGION
  instances = $result
}

$out | ConvertTo-Json -Depth 6
