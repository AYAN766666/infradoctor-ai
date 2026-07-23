param(
  [ValidateSet("frontend", "backend", "all")]
  [string]$Target = "all"
)

$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-Color($Color, $Message) {
  Write-Host $Message -ForegroundColor $Color
}

function Test-VercelCLI {
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Color $Red "Vercel CLI not found. Install it with: npm i -g vercel"
    exit 1
  }
}

function Run-VercelDeploy($Name, $Dir) {
  Write-Host ""
  Write-Color $Cyan "=== Deploying $Name to Vercel ==="
  $prev = Get-Location
  Set-Location -LiteralPath (Join-Path $PSScriptRoot "..\$Dir")
  vercel --prod
  if ($?) {
    Write-Color $Green "$Name deployed successfully!"
  } else {
    Write-Color $Red "$Name deployment failed."
    Write-Color $Yellow "Hint: Run 'vercel login' first if you haven't."
    Set-Location -LiteralPath $prev
    exit 1
  }
  Set-Location -LiteralPath $prev
}

function Show-Urls {
  Write-Host ""
  Write-Color $Cyan "=== Deployed URLs ==="
  Write-Host "  Frontend: https://infradoctor-frontend.vercel.app"
  Write-Host "  Backend:  https://infradoctor-backend.vercel.app"
}

# Main
Write-Color $Cyan "========================================"
Write-Color $Cyan "    InfraDoctor Deploy Tool"
Write-Color $Cyan "========================================"

Test-VercelCLI

switch ($Target) {
  "frontend" { Run-VercelDeploy "Frontend" "frontend" }
  "backend"  { Run-VercelDeploy "Backend" "backend" }
  "all" {
    Run-VercelDeploy "Backend" "backend"
    Run-VercelDeploy "Frontend" "frontend"
  }
}

Show-Urls
Write-Host ""
Write-Color $Green "All deployments complete!"
