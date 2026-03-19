param(
  [string]$REGION = "us-east-2"
)

$IDS = @("i-0f0e251f85548b8c8","i-0bb4e6b6787d754c4")

$result = @()

foreach($id in $IDS){

  $inst = aws ec2 describe-instances --instance-ids $id --region $REGION --output json | ConvertFrom-Json

  $subnetId = $inst.Reservations[0].Instances[0].SubnetId
  $vpcId    = $inst.Reservations[0].Instances[0].VpcId

  $networkInterfaces = $inst.Reservations[0].Instances[0].NetworkInterfaces |
    ForEach-Object { $_.NetworkInterfaceId }

  $securityGroups = $inst.Reservations[0].Instances[0].SecurityGroups |
    ForEach-Object { $_.GroupId }

  $r = [PSCustomObject]@{
    id                 = $id
    subnetId           = $subnetId
    vpcId              = $vpcId
    networkInterfaces  = $networkInterfaces
    securityGroups     = $securityGroups
  }

  $result += $r
}

$out = [PSCustomObject]@{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  region    = $REGION
  instances = $result
}

$outFile = Join-Path $PSScriptRoot "ec2_network_details.json"

$out | ConvertTo-Json -Depth 8 | Out-File $outFile -Encoding utf8

Write-Output "Saved $outFile"