@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Trying to install Node.js LTS with winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo.
    echo winget is not available on this PC.
    echo Install Node.js LTS manually from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )

  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo Node.js install failed.
    echo Install Node.js LTS manually from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )

  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo npm.cmd was not found.
  echo If Node.js was just installed, close this window and run this file again.
  pause
  exit /b 1
)

call "%~dp0start-overlay.cmd"
