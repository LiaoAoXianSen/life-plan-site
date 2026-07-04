$ErrorActionPreference = 'Stop'

$root = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zip = Join-Path $root "life-plan-site-clean-$stamp.zip"

$excludeDirs = @(
    '.git',
    'ai-memory',
    'docs',
    'node_modules',
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

$zipItem = Get-Item -LiteralPath $zip
[PSCustomObject]@{
    Name = $zipItem.Name
    FullName = $zipItem.FullName
    Length = $zipItem.Length
    ExcludedDirs = ($excludeDirs -join ', ')
    ExcludedFiles = ($excludeFiles -join ', ')
} | Format-List
