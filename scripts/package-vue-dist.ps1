param(
    [ValidateRange(1, 100)]
    [int]$KeepCount = 5,

    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
Set-Location -LiteralPath $root

if (-not $SkipBuild) {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }
}

$dist = Join-Path $root 'dist'
if (-not (Test-Path -LiteralPath $dist -PathType Container)) {
    throw "Vue dist directory missing: $dist. Run npm run build first."
}

$required = @(
    (Join-Path $dist 'index.html')
)
foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Vue dist artifact missing: $path"
    }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zip = Join-Path $root "life-plan-site-vue-dist-$stamp.zip"
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) "life-plan-site-vue-dist-$stamp"

try {
    New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
    Copy-Item -Path (Join-Path $dist '*') -Destination $stageRoot -Recurse -Force
    if (Test-Path -LiteralPath $zip) {
        Remove-Item -LiteralPath $zip -Force
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stageRoot,
        $zip,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )
}
finally {
    $resolvedStage = Resolve-Path -LiteralPath $stageRoot -ErrorAction SilentlyContinue
    $tempRoot = [System.IO.Path]::GetTempPath()
    if ($resolvedStage -and $resolvedStage.Path.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStage.Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$allPackages = Get-ChildItem -LiteralPath $root -File -Filter 'life-plan-site-vue-dist-*.zip' |
    Sort-Object LastWriteTimeUtc, Name -Descending
$removedPackages = @()
if ($allPackages.Count -gt $KeepCount) {
    $removedPackages = $allPackages | Select-Object -Skip $KeepCount
    foreach ($package in $removedPackages) {
        Remove-Item -LiteralPath $package.FullName -Force
    }
}

$zipItem = Get-Item -LiteralPath $zip
$included = Get-ChildItem -LiteralPath $dist -Recurse -File | ForEach-Object {
    $_.FullName.Substring($dist.Length).TrimStart('\', '/')
}

[PSCustomObject]@{
    Name = $zipItem.Name
    FullName = $zipItem.FullName
    Length = $zipItem.Length
    KeepCount = $KeepCount
    Source = 'dist/'
    IncludedFiles = ($included -join ', ')
    RemovedOldPackages = $removedPackages.Count
    RemovedPackages = ($removedPackages.Name -join ', ')
    Note = 'Vue dist package only. Do not use scripts/package-clean.ps1 for Vue artifacts.'
} | Format-List
