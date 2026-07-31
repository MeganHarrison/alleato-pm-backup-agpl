[CmdletBinding()]
param(
  [string]$SharedEnvironmentPath = (Join-Path $env:USERPROFILE ".codex\capabilities\alleato-project-management.env"),
  [switch]$InstallPowerShellProfile
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $key = $matches[1]
      $value = $matches[2].Trim().Trim('"').Trim("'")
      if ($value) {
        $values[$key] = $value
      }
    }
  }
  return $values
}

function Test-RenderCredential {
  param([string]$Token)
  try {
    $response = Invoke-WebRequest `
      -Uri "https://api.render.com/v1/owners?limit=1" `
      -Headers @{ Authorization = "Bearer $Token"; Accept = "application/json" } `
      -UseBasicParsing `
      -TimeoutSec 20
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-HttpCredential {
  param(
    [string]$Kind,
    [string]$Token
  )
  try {
    if ($Kind -eq "AI_GATEWAY_API_KEY") {
      $response = Invoke-WebRequest `
        -Uri "https://ai-gateway.vercel.sh/v1/models" `
        -Headers @{ Authorization = "Bearer $Token" } `
        -UseBasicParsing `
        -TimeoutSec 20
    } elseif ($Kind -eq "OPENAI_API_KEY") {
      $response = Invoke-WebRequest `
        -Uri "https://api.openai.com/v1/models" `
        -Headers @{ Authorization = "Bearer $Token" } `
        -UseBasicParsing `
        -TimeoutSec 20
    } elseif ($Kind -eq "LINEAR_API_KEY") {
      $response = Invoke-WebRequest `
        -Uri "https://api.linear.app/graphql" `
        -Method Post `
        -Headers @{ Authorization = $Token; "Content-Type" = "application/json" } `
        -Body '{"query":"query { viewer { id } }"}' `
        -UseBasicParsing `
        -TimeoutSec 20
    } else {
      throw "Unsupported credential check: $Kind"
    }
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Find-RenderCredential {
  $historyRoot = Join-Path $env:APPDATA "Code\User\History"
  if (-not (Test-Path -LiteralPath $historyRoot)) {
    return ""
  }
  foreach ($file in Get-ChildItem -LiteralPath $historyRoot -File -Recurse -ErrorAction SilentlyContinue) {
    $values = Read-DotEnv -Path $file.FullName
    $candidate = $values["RENDER_API_KEY"]
    if ($candidate -and (Test-RenderCredential -Token $candidate)) {
      return $candidate
    }
  }
  return ""
}

function Find-RenderEnvironmentValue {
  param(
    [string]$Token,
    [string]$Key
  )
  $headers = @{ Authorization = "Bearer $Token"; Accept = "application/json" }
  $services = Invoke-RestMethod `
    -Uri "https://api.render.com/v1/services?limit=100" `
    -Headers $headers `
    -Method Get `
    -TimeoutSec 20
  foreach ($entry in $services) {
    if ($entry.service.name -notmatch '^alleato-') {
      continue
    }
    $rows = Invoke-RestMethod `
      -Uri "https://api.render.com/v1/services/$($entry.service.id)/env-vars?limit=100" `
      -Headers $headers `
      -Method Get `
      -TimeoutSec 20
    $match = $rows |
      Where-Object { $_.envVar.key -eq $Key -and $_.envVar.value } |
      Select-Object -First 1
    if ($match) {
      return $match.envVar.value
    }
  }
  return ""
}

function Write-EnvironmentAtomically {
  param(
    [string]$Path,
    [hashtable]$Values
  )
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $temporary = "$Path.$PID.tmp"
  $lines = $Values.GetEnumerator() |
    Sort-Object Key |
    ForEach-Object { "$($_.Key)=$($_.Value)" }
  [IO.File]::WriteAllLines($temporary, $lines, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
  if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
    & icacls.exe $Path /inheritance:r /grant:r "$env:USERNAME`:F" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to restrict the shared environment ACL."
    }
  }
}

function Install-AlleatoPowerShellProfile {
  $profilePath = $PROFILE.CurrentUserAllHosts
  $profileDirectory = Split-Path -Parent $profilePath
  New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
  $start = "# BEGIN ALLEATO MACHINE ENVIRONMENT"
  $end = "# END ALLEATO MACHINE ENVIRONMENT"
  $existing = if (Test-Path -LiteralPath $profilePath) {
    Get-Content -LiteralPath $profilePath -Raw
  } else {
    ""
  }
  $block = @'
# BEGIN ALLEATO MACHINE ENVIRONMENT
$alleatoMachineEnvironment = Join-Path $env:USERPROFILE ".codex\capabilities\alleato-project-management.env"
if (Test-Path -LiteralPath $alleatoMachineEnvironment) {
  foreach ($alleatoEnvironmentLine in Get-Content -LiteralPath $alleatoMachineEnvironment) {
    if ($alleatoEnvironmentLine -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $alleatoEnvironmentKey = $matches[1]
      $alleatoEnvironmentValue = $matches[2].Trim().Trim('"').Trim("'")
      if ($alleatoEnvironmentValue) {
        Set-Item -Path "Env:$alleatoEnvironmentKey" -Value $alleatoEnvironmentValue
      }
    }
  }
}
# END ALLEATO MACHINE ENVIRONMENT
'@
  $pattern = "(?s)$([regex]::Escape($start)).*?$([regex]::Escape($end))\r?\n?"
  $updated = if ($existing -match $pattern) {
    [regex]::Replace(
      $existing,
      $pattern,
      [Text.RegularExpressions.MatchEvaluator]{ param($match) $block }
    )
  } else {
    "$existing$([Environment]::NewLine)$block"
  }
  [IO.File]::WriteAllText($profilePath, $updated.TrimStart(), [Text.UTF8Encoding]::new($false))
  return $profilePath
}

$shared = Read-DotEnv -Path $SharedEnvironmentPath
$sources = @(
  (Join-Path $env:USERPROFILE "alleato-pm-backup\agents\alleato-assistant\.env.local"),
  (Join-Path $env:USERPROFILE "alleato-pm-backup\frontend\.env.local"),
  (Join-Path $env:USERPROFILE "alleato-pm-backup\frontend\.env")
)
$requiredKeys = @(
  "DATABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
  "AZURE_DOCUMENT_INTELLIGENCE_KEY"
)
$added = [Collections.Generic.List[string]]::new()
foreach ($sourcePath in $sources) {
  $source = Read-DotEnv -Path $sourcePath
  foreach ($key in $requiredKeys) {
    if (-not $shared[$key] -and $source[$key]) {
      $shared[$key] = $source[$key]
      $added.Add($key)
    }
  }
}
$validatedKeys = @("AI_GATEWAY_API_KEY", "OPENAI_API_KEY", "LINEAR_API_KEY")
foreach ($key in $validatedKeys) {
  if ($shared[$key] -and (Test-HttpCredential -Kind $key -Token $shared[$key])) {
    continue
  }
  $replacement = ""
  foreach ($sourcePath in $sources) {
    $source = Read-DotEnv -Path $sourcePath
    if (
      $source[$key] -and
      (Test-HttpCredential -Kind $key -Token $source[$key])
    ) {
      $replacement = $source[$key]
      break
    }
  }
  if (-not $replacement) {
    throw "$key capability is unavailable: no locally recoverable credential passed authenticated readback."
  }
  $shared[$key] = $replacement
  $added.Add($key)
}
if (-not $shared["RENDER_API_KEY"]) {
  $renderCredential = Find-RenderCredential
  if ($renderCredential) {
    $shared["RENDER_API_KEY"] = $renderCredential
    $added.Add("RENDER_API_KEY")
  }
}
if (-not $shared["RENDER_API_KEY"]) {
  throw "Render capability is unavailable: no locally recoverable authenticated credential was found."
}
if (-not (Test-RenderCredential -Token $shared["RENDER_API_KEY"])) {
  throw "Render capability is unavailable: the configured credential failed authenticated readback."
}
if (-not $shared["SLACK_WEBHOOK_URL"]) {
  $slackWebhook = Find-RenderEnvironmentValue `
    -Token $shared["RENDER_API_KEY"] `
    -Key "SLACK_WEBHOOK_URL"
  if ($slackWebhook) {
    $shared["SLACK_WEBHOOK_URL"] = $slackWebhook
    $added.Add("SLACK_WEBHOOK_URL")
  }
}

Write-EnvironmentAtomically -Path $SharedEnvironmentPath -Values $shared
$profilePath = ""
if ($InstallPowerShellProfile) {
  $profilePath = Install-AlleatoPowerShellProfile
}

Write-Output "Shared machine environment ready."
Write-Output "Added keys: $($added -join ', ')"
Write-Output "Render authenticated readback: pass"
Write-Output "AI Gateway authenticated readback: pass"
Write-Output "OpenAI authenticated readback: pass"
Write-Output "Linear authenticated readback: pass"
if ($profilePath) {
  Write-Output "PowerShell environment loader: $profilePath"
}
