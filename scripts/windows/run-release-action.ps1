param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,

  [Parameter(Mandatory = $true)]
  [ValidateSet('platform', 'install', 'ship', 'dist', 'packaged', 'evidence')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$ResolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$NodeDir = Join-Path $ResolvedRoot '.tools\node'
$Node = Join-Path $NodeDir 'node.exe'
$Npm = Join-Path $NodeDir 'npm.cmd'
$env:Path = "$NodeDir;$env:Path"
$env:NODE_OPTIONS = '--max-old-space-size=3072'
Set-Location -LiteralPath $ResolvedRoot

function Assert-Exit([string]$Label) {
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

switch ($Action) {
  'platform' {
    & $Node -p 'JSON.stringify({platform:process.platform,arch:process.arch,node:process.version})'
    Assert-Exit 'Platform probe'
  }
  'install' {
    & $Npm ci --no-audit --no-fund
    Assert-Exit 'npm ci'
  }
  'ship' {
    $env:CI = '1'
    $env:FORCE_COLOR = '0'
    $env:KNOT_WINDOWS_EVIDENCE = '1'
    & $Npm run test:ship
    Assert-Exit 'Windows ship gate'
  }
  'dist' {
    $env:CI = '1'
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    & $Npm run dist -- --win --x64
    Assert-Exit 'Windows distribution build'
  }
  'packaged' {
    $env:CI = '1'
    & $Node 'tests\packaged-windows-smoke.mjs'
    Assert-Exit 'Packaged Windows smoke test'
  }
  'evidence' {
    $Evidence = Join-Path $ResolvedRoot 'windows-release-evidence.zip'
    if (Test-Path $Evidence) { Remove-Item $Evidence -Force }
    $Inputs = @()
    if (Test-Path (Join-Path $ResolvedRoot 'test-results')) { $Inputs += (Join-Path $ResolvedRoot 'test-results') }
    if (Test-Path (Join-Path $ResolvedRoot 'release\builder-effective-config.yaml')) { $Inputs += (Join-Path $ResolvedRoot 'release\builder-effective-config.yaml') }
    Compress-Archive -Path $Inputs -DestinationPath $Evidence -CompressionLevel Optimal
    Write-Output $Evidence
  }
}
