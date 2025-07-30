<#
  load-env.ps1
  • parses .env in repo root
  • exports each KEY=VAL into the current PowerShell process
  • prints a table of what was set
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$envFile = ".env"
if (-not (Test-Path $envFile)) {
  Write-Host ".env not found in $PWD"
  exit 1
}

# ---- 1. load vars --------------------------------------------------------
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([\w.]+)\s*=\s*(.*)\s*$') {
    $name  = $matches[1]
    $value = $matches[2]

    # strip surrounding quotes (single or double)
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "env:$name" -Value $value
  }
}

# ---- 2. echo snapshot ----------------------------------------------------
Write-Host "`n  .env variables loaded. current session values:`n"

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([\w.]+)\s*=') {
    $name  = $matches[1]
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not $value) { $value = "(not set)" }
    Write-Host ("{0,-25} = {1}" -f $name, $value)
  }
}

Write-Host ""
