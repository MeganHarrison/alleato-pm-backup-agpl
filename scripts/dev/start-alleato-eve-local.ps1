param(
  [int]$FrontendPort = 3012,
  [int]$EvePort = 3013
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$frontendRoot = Join-Path $repoRoot "frontend"
$eveRoot = Join-Path $repoRoot "agents\alleato-assistant"
$frontendEnv = Join-Path $frontendRoot ".env.local"
$eveEnv = Join-Path $eveRoot ".env.local"

foreach ($port in @($FrontendPort, $EvePort)) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    throw "Port $port is already in use by process $($listener[0].OwningProcess)."
  }
}

if (-not (Test-Path -LiteralPath $frontendEnv)) {
  throw "Missing frontend environment file: $frontendEnv"
}

if (-not (Test-Path -LiteralPath $eveEnv)) {
  throw "Missing canonical Eve environment file: $eveEnv"
}

foreach ($line in Get-Content -LiteralPath $frontendEnv) {
  if ($line -notmatch "^([^#=]+)=(.*)$") {
    continue
  }

  $name = $matches[1]
  $value = $matches[2].Trim('"')
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

$oidcLine = Get-Content -LiteralPath $eveEnv |
  Where-Object { $_ -match "^VERCEL_OIDC_TOKEN=(.*)$" } |
  Select-Object -First 1
if (-not $oidcLine -or $oidcLine -notmatch "^VERCEL_OIDC_TOKEN=(.*)$") {
  throw "Missing VERCEL_OIDC_TOKEN in $eveEnv. Run Vercel env pull for the linked Eve project."
}
$env:VERCEL_OIDC_TOKEN = $matches[1].Trim('"')

# `vercel env pull` includes deployment-only markers. They must not leak into
# local Next/Eve processes: Eve otherwise selects the read-only Vercel world
# and local session requests can be redirected through deployment auth.
foreach ($deploymentOnlyVariable in @(
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "VERCEL_URL"
)) {
  [Environment]::SetEnvironmentVariable($deploymentOnlyVariable, $null, "Process")
}

$secretBytes = New-Object byte[] 48
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($secretBytes)
$random.Dispose()

$env:ALLEATO_EVE_PROXY_SECRET = [Convert]::ToBase64String($secretBytes)
$env:ALLEATO_EVE_URL = "http://localhost:$EvePort"
$env:ALLEATO_APP_URL = "http://localhost:$FrontendPort"
# Reuse the generated local Workflow artifacts. Without this flag the
# Workflow watcher observes Next's generated output and repeatedly rebuilds,
# which prevents /ai from reaching a stable ready state during browser QA.
$env:WORKFLOW_NEXT_PRIVATE_BUILT = "1"

$eveOut = Join-Path $env:TEMP "alleato-assistant-eve-local.log"
$eveErr = Join-Path $env:TEMP "alleato-assistant-eve-local.err.log"
$frontendOut = Join-Path $env:TEMP "alleato-frontend-local.log"
$frontendErr = Join-Path $env:TEMP "alleato-frontend-local.err.log"

$eveProcess = Start-Process `
  -FilePath "pnpm.cmd" `
  -ArgumentList @("dev", "--port", "$EvePort", "--no-ui") `
  -WorkingDirectory $eveRoot `
  -RedirectStandardOutput $eveOut `
  -RedirectStandardError $eveErr `
  -WindowStyle Hidden `
  -PassThru

$frontendProcess = Start-Process `
  -FilePath "npx.cmd" `
  -ArgumentList @("next", "dev", "-p", "$FrontendPort") `
  -WorkingDirectory $frontendRoot `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -WindowStyle Hidden `
  -PassThru

[pscustomobject]@{
  FrontendUrl = "http://localhost:$FrontendPort"
  EveUrl = "http://localhost:$EvePort"
  FrontendProcessId = $frontendProcess.Id
  EveProcessId = $eveProcess.Id
  FrontendLog = $frontendOut
  EveLog = $eveOut
}
