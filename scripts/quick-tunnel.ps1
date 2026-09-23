#requires -Version 5.1
<#
.SYNOPSIS
  Start a free Cloudflare quick tunnel to the Sentient web app and automatically
  (re)register the Telegram webhook, so a rotating *.trycloudflare.com URL needs
  zero manual steps.

.DESCRIPTION
  Quick tunnels are free and need no Cloudflare account or domain, but mint a new
  random hostname on every run. This script:
    1. starts  cloudflared tunnel --url http://localhost:3000
    2. waits for the assigned https://<random>.trycloudflare.com URL
    3. calls Telegram setWebhook with <url>/api/ai/channels/telegram/webhook and
       the secret token read from apps/ai-agentic/.env
    4. rewrites TELEGRAM_WEBHOOK_URL in .env to that live URL, so if ai-agentic
       restarts, its boot-time setWebhook re-registers the SAME URL, not a stale one
    5. keeps the tunnel in the foreground; Ctrl+C stops the tunnel

  Prereqs:
    - cloudflared installed:  winget install --id Cloudflare.cloudflared
    - the app running (turbo dev): web :3000, gateway :3004, ai-agentic :3003
    - apps/ai-agentic/.env has TELEGRAM_MODE=webhook, TELEGRAM_BOT_TOKEN,
      TELEGRAM_WEBHOOK_SECRET

.EXAMPLE
  pwsh ./scripts/quick-tunnel.ps1
#>
[CmdletBinding()]
param(
  [string]$LocalTarget = 'http://localhost:3000',
  [string]$WebhookPath = '/api/ai/channels/telegram/webhook'
)

$ErrorActionPreference = 'Stop'

# repo root = the parent of this scripts/ folder
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath  = Join-Path $repoRoot 'apps\ai-agentic\.env'
if (-not (Test-Path $envPath)) { throw "Cannot find $envPath" }

function Get-EnvValue([string]$key) {
  $m = Select-String -Path $envPath -Pattern "^\s*$key\s*=(.*)$" | Select-Object -First 1
  if (-not $m) { throw "Missing $key in $envPath" }
  return $m.Matches[0].Groups[1].Value.Trim()
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared not found on PATH. Install: winget install --id Cloudflare.cloudflared"
}

$token  = Get-EnvValue 'TELEGRAM_BOT_TOKEN'
$secret = Get-EnvValue 'TELEGRAM_WEBHOOK_SECRET'
if ([string]::IsNullOrWhiteSpace($token))  { throw "TELEGRAM_BOT_TOKEN is empty in .env" }
if ([string]::IsNullOrWhiteSpace($secret)) { throw "TELEGRAM_WEBHOOK_SECRET is empty in .env" }

# cloudflared writes the tunnel banner (with the URL) to stderr; capture both.
$errLog = [System.IO.Path]::GetTempFileName()
$outLog = [System.IO.Path]::GetTempFileName()

Write-Host "Starting Cloudflare quick tunnel -> $LocalTarget ..." -ForegroundColor Cyan
$proc = Start-Process -FilePath 'cloudflared' `
  -ArgumentList @('tunnel', '--url', $LocalTarget) `
  -RedirectStandardError $errLog -RedirectStandardOutput $outLog `
  -NoNewWindow -PassThru

try {
  # Poll the logs (~30s) for the assigned public URL.
  $publicUrl = $null
  for ($i = 0; $i -lt 60 -and -not $publicUrl; $i++) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) {
      $log = (Get-Content -Path $errLog, $outLog -Raw -ErrorAction SilentlyContinue) -join "`n"
      throw "cloudflared exited before a URL appeared. Log:`n$log"
    }
    $text  = (Get-Content -Path $errLog, $outLog -Raw -ErrorAction SilentlyContinue) -join "`n"
    $match = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) { $publicUrl = $match.Value }
  }
  if (-not $publicUrl) { throw "Timed out waiting for the tunnel URL." }
  Write-Host "Tunnel URL: $publicUrl" -ForegroundColor Green

  # Register the webhook with Telegram. drop_pending_updates clears anything queued
  # from the previous (dead) URL or the polling era.
  $fullUrl = "$publicUrl$WebhookPath"
  $body = @{ url = $fullUrl; secret_token = $secret; drop_pending_updates = 'true' }
  $resp = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body $body
  if (-not $resp.ok) { throw "setWebhook failed: $($resp | ConvertTo-Json -Compress)" }
  Write-Host "OK  Telegram webhook -> $fullUrl" -ForegroundColor Green

  # Persist the live URL into .env so an ai-agentic restart re-registers the same
  # URL (its boot-time setWebhook reads TELEGRAM_WEBHOOK_URL), never a stale one.
  $lines   = [System.IO.File]::ReadAllLines($envPath)
  $updated = $false
  for ($j = 0; $j -lt $lines.Count; $j++) {
    if ($lines[$j] -match '^\s*TELEGRAM_WEBHOOK_URL\s*=') {
      $lines[$j] = "TELEGRAM_WEBHOOK_URL=$fullUrl"; $updated = $true; break
    }
  }
  if ($updated) {
    [System.IO.File]::WriteAllLines($envPath, $lines)   # UTF-8 without BOM
    Write-Host "Updated TELEGRAM_WEBHOOK_URL in apps/ai-agentic/.env" -ForegroundColor DarkGray
  }

  Write-Host "`nTunnel live. Leave this window open. Press Ctrl+C to stop.`n" -ForegroundColor Cyan
  # Tail the tunnel log until Ctrl+C.
  Get-Content -Path $errLog -Wait
}
finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $errLog, $outLog -ErrorAction SilentlyContinue
}
