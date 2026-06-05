$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = Get-Content -Raw -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json
$version = [string]$packageJson.devDependencies.electron
$version = $version -replace "^[^\d]*", ""

$arch = (& node -p "process.arch").Trim()
if ($arch -eq "ia32") {
  $electronArch = "ia32"
} elseif ($arch -eq "arm64") {
  $electronArch = "arm64"
} else {
  $electronArch = "x64"
}

$electronDir = Join-Path $root "node_modules\electron"
$distDir = Join-Path $electronDir "dist"
$exePath = Join-Path $distDir "electron.exe"
$pathTxt = Join-Path $electronDir "path.txt"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

$cacheRoot = Join-Path $env:LOCALAPPDATA "electron\Cache"
$zipName = "electron-v$version-win32-$electronArch.zip"
$zipPath = $null

if (Test-Path -LiteralPath $cacheRoot) {
  $cached = Get-ChildItem -LiteralPath $cacheRoot -Recurse -Filter $zipName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cached) {
    $zipPath = $cached.FullName
  }
}

if (-not $zipPath) {
  $downloadDir = Join-Path $root ".electron-download"
  New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
  $zipPath = Join-Path $downloadDir $zipName
  $url = "https://github.com/electron/electron/releases/download/v$version/$zipName"
  Write-Host "Downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $zipPath
}

Write-Host "Extracting $zipPath"
Expand-Archive -LiteralPath $zipPath -DestinationPath $distDir -Force
Set-Content -LiteralPath $pathTxt -Value "electron.exe" -NoNewline

if (-not (Test-Path -LiteralPath $exePath)) {
  throw "electron.exe was not created at $exePath"
}

Write-Host "Electron repaired: $exePath"
