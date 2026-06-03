@echo off
setlocal

cd /d "%~dp0"

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "PYTHON=%BACKEND%\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo [ERROR] Backend Python virtual environment not found:
  echo %PYTHON%
  echo.
  pause
  exit /b 1
)

if not exist "%FRONTEND%\node_modules" (
  echo [ERROR] Frontend node_modules not found:
  echo %FRONTEND%\node_modules
  echo Run npm install in the frontend folder first.
  echo.
  pause
  exit /b 1
)

start "LOL Scrim Backend" /D "%BACKEND%" cmd /k ""%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
start "LOL Scrim Frontend" /D "%FRONTEND%" cmd /k "npm.cmd run dev -- --host 127.0.0.1"

set "CLOUDFLARE_TUNNEL_TOKEN="
if exist "%ROOT%.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do (
    if "%%A"=="CLOUDFLARE_TUNNEL_TOKEN" set "CLOUDFLARE_TUNNEL_TOKEN=%%B"
  )
)

if defined CLOUDFLARE_TUNNEL_TOKEN (
  where cloudflared >nul 2>nul
  if errorlevel 1 (
    echo [WARN] cloudflared is not installed or not in PATH. Local site will still run.
  ) else (
    start "LOL Scrim Cloudflare Tunnel" cmd /k cloudflared tunnel run --token "%CLOUDFLARE_TUNNEL_TOKEN%"
  )
) else (
  echo [INFO] CLOUDFLARE_TUNNEL_TOKEN not found in .env. Local site will still run.
)

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo Site startup commands have been launched.
echo Local frontend: http://127.0.0.1:5173
echo Backend API:     http://127.0.0.1:8000
echo.
echo Keep the opened Backend, Frontend, and Cloudflare windows running.
echo Close those windows to stop the site.
echo.
pause
