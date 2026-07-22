$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
Push-Location $root

try {
    Write-Host "Checking JavaScript syntax..."
    node --check .\app.js
    node --check .\habit-engine.js
    node --check .\habit-ui.js
    node --check .\habit-service.js
    node --check .\fitness-service.js
    node --check .\fitness-ui.js
    node --check .\wheel-tool.js
    node --check .\sync-service.js
    node --check .\snapshot-service.js
    node --check .\records-service.js
    node --check .\todos-service.js
    node --check .\ai-service.js
    if (Test-Path .\playwright.config.js) {
        node --check .\playwright.config.js
    }

    if (Test-Path .\package.json) {
        Write-Host "Running Playwright smoke tests..."
        npm test
    }

    Write-Host "Checking Git working tree..."
    $status = git status --short
    if ($status) {
        Write-Host $status
        Write-Host "Git working tree has local changes."
    } else {
        Write-Host "Git working tree is clean."
    }

    Write-Host "Basic checks completed."
} finally {
    Pop-Location
}
