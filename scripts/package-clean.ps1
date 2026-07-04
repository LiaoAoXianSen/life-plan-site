$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zip = Join-Path $root "life-plan-site-clean-$stamp.zip"
$keepCount = if ($args.Count -gt 0 -and $args[0]) { [Math]::Max(1, [int]$args[0]) } else { 5 }

$excludeDirs = @(
    '.git',
    'ai-memory',
    'docs',
    'node_modules',
    'test-results',
    '.tmp',
    'tmp',
    'temp',
    '.cache',
    'dist',
    'build'
)
$excludeFiles = @('*.zip', '*.log')

$items = Get-ChildItem -Path $root -Force | Where-Object {
    $name = $_.Name
    if ($excludeDirs -contains $name) { return $false }
    foreach ($pattern in $excludeFiles) {
        if ($name -like $pattern) { return $false }
    }
    return $true
}

if (-not $items) {
    throw "No files found to package."
}

Compress-Archive -LiteralPath $items.FullName -DestinationPath $zip -CompressionLevel Optimal -Force

$allPackages = Get-ChildItem -Path $root -File -Filter 'life-plan-site-clean-*.zip' |
    Sort-Object LastWriteTime -Descending
$removedPackages = @()
if ($allPackages.Count -gt $keepCount) {
    $removedPackages = $allPackages | Select-Object -Skip $keepCount
    foreach ($package in $removedPackages) {
        Remove-Item -LiteralPath $package.FullName -Force
    }
}

$zipItem = Get-Item -LiteralPath $zip
[PSCustomObject]@{
    Name = $zipItem.Name
    FullName = $zipItem.FullName
    Length = $zipItem.Length
    KeepCount = $keepCount
    RemovedOldPackages = $removedPackages.Count
    ExcludedDirs = ($excludeDirs -join ', ')
    ExcludedFiles = ($excludeFiles -join ', ')
} | Format-List
