$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$port = if ($args.Count -gt 0 -and $args[0]) { [int]$args[0] } else { 5173 }

Write-Host "Serving life-plan-site from $root"
Write-Host "Open: http://localhost:$port/"

$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    Push-Location $root
    try {
        & py -m http.server $port
    } finally {
        Pop-Location
    }
    exit $LASTEXITCODE
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    Push-Location $root
    try {
        & python -m http.server $port
    } finally {
        Pop-Location
    }
    exit $LASTEXITCODE
}

throw "Python was not found. Install Python or open index.html directly for a quick manual preview."
