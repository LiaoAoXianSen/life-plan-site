param(
    [ValidateRange(1, 100)]
    [int]$KeepCount = 5
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zip = Join-Path $root "life-plan-site-runtime-$stamp.zip"

$runtimeFiles = @(
    'index.html',
    'app.js',
    'styles.css',
    'habit-engine.js',
    'habit-ui.js',
    'habit-style.css',
    'wheel-tool.js',
    'wheel-tool.css'
)

$items = foreach ($file in $runtimeFiles) {
    $path = Join-Path $root $file
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Runtime file missing: $file"
    }
    Get-Item -LiteralPath $path
}

Compress-Archive -LiteralPath $items.FullName -DestinationPath $zip -CompressionLevel Optimal -Force

$allPackages = Get-ChildItem -LiteralPath $root -File -Filter 'life-plan-site-runtime-*.zip' |
    Sort-Object LastWriteTimeUtc, Name -Descending
$removedPackages = @()
if ($allPackages.Count -gt $KeepCount) {
    $removedPackages = $allPackages | Select-Object -Skip $KeepCount
    foreach ($package in $removedPackages) {
        Remove-Item -LiteralPath $package.FullName -Force
    }
}

$zipItem = Get-Item -LiteralPath $zip
[PSCustomObject]@{
    Name = $zipItem.Name
    FullName = $zipItem.FullName
    Length = $zipItem.Length
    KeepCount = $KeepCount
    IncludedFiles = ($runtimeFiles -join ', ')
    RemovedOldPackages = $removedPackages.Count
    RemovedPackages = ($removedPackages.Name -join ', ')
} | Format-List
