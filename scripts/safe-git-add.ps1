# Safe git add - prevents adding large JSON files
# Usage: .\scripts\safe-git-add.ps1

$excludedPatterns = @(
    "*json_big_xml*.json"
)

Write-Host "🔍 Checking for large JSON files..." -ForegroundColor Yellow

$foundFiles = @()
foreach ($pattern in $excludedPatterns) {
    $files = Get-ChildItem -Recurse -Include $pattern -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*node_modules*" }
    foreach ($file in $files) {
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
        $foundFiles += $relativePath
    }
}

if ($foundFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  WARNING: Found large JSON files that should NOT be committed:" -ForegroundColor Red
    foreach ($file in $foundFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "These files are ignored by .gitignore. Using git add . will skip them." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ Safe to proceed with: git add ." -ForegroundColor Green


