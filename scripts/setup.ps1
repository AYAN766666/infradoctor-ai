Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   InfraDoctor - Project Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
$hasNode = Get-Command node -ErrorAction SilentlyContinue
$hasPython = Get-Command python -ErrorAction SilentlyContinue
$hasDocker = Get-Command docker -ErrorAction SilentlyContinue

if (-not $hasNode) { Write-Host "[WARN] Node.js not found. Install from https://nodejs.org" -ForegroundColor Yellow }
if (-not $hasPython) { Write-Host "[WARN] Python not found. Install from https://python.org" -ForegroundColor Yellow }
if (-not $hasDocker) { Write-Host "[WARN] Docker not found. Install from https://docker.com" -ForegroundColor Yellow }

Write-Host "`n--- Backend Setup ---" -ForegroundColor Cyan
if (-not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env"
  Write-Host "[OK] Created backend\.env from .env.example" -ForegroundColor Green
  Write-Host "[!] Edit backend\.env and add your real tokens:" -ForegroundColor Yellow
  Write-Host "    GITHUB_TOKEN, JWT_SECRET, GROQ_API_KEY" -ForegroundColor Yellow
} else {
  Write-Host "[OK] backend\.env already exists" -ForegroundColor Green
}

Write-Host "`n--- Frontend Setup ---" -ForegroundColor Cyan
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..\frontend")
if (Test-Path "node_modules") {
  Write-Host "[OK] node_modules exists" -ForegroundColor Green
} else {
  Write-Host "[...] Installing frontend dependencies..." -ForegroundColor Cyan
  npm install
  if ($?) { Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green }
  else { Write-Host "[FAIL] npm install failed" -ForegroundColor Red }
}
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..")

Write-Host "`n--- Backend Dependencies ---" -ForegroundColor Cyan
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..\backend")
if (Test-Path "venv") {
  Write-Host "[OK] Python venv exists" -ForegroundColor Green
} else {
  Write-Host "[...] Creating Python venv..." -ForegroundColor Cyan
  python -m venv venv
  if ($?) { Write-Host "[OK] Virtual env created" -ForegroundColor Green }
}
Write-Host "[...] Installing Python packages..." -ForegroundColor Cyan
& ".\venv\Scripts\pip" install -r requirements.txt 2>$null
if ($?) { Write-Host "[OK] Python dependencies installed" -ForegroundColor Green }
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..")

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit backend\.env with your tokens"
Write-Host "  2. Run: npm run dev          (Docker)"
Write-Host "  3. Or:   npm run dev:backend  (Python only)"
Write-Host "  4. Or:   npm run dev:frontend (Next.js only)"
Write-Host ""
