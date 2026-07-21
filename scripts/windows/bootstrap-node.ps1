param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$Version = '22.22.2'
$ResolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$Destination = Join-Path $ResolvedRoot '.tools\node'
$Archive = Join-Path $env:TEMP "node-v$Version-win-x64.zip"
$Stage = Join-Path $env:TEMP 'knot-release-node'
$Source = Join-Path $Stage "node-v$Version-win-x64"

if (Test-Path (Join-Path $Destination 'node.exe')) {
  Write-Output "Node already installed at $Destination"
  exit 0
}

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

try {
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$Version/node-v$Version-win-x64.zip" -OutFile $Archive
  Expand-Archive -LiteralPath $Archive -DestinationPath $Stage -Force
  Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
  & (Join-Path $Destination 'node.exe') --version
} finally {
  if (Test-Path $Archive) { Remove-Item $Archive -Force }
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
}
