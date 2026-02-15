@echo off
echo ========================================
echo VMM Tracker Data Sender - Development Environment
echo ========================================
echo.
echo NOTE: Make sure Vite dev server is already running!
echo       Run 'npm run dev' in the web directory first.
echo.

REM Open browser
echo [1/2] Opening browser...
start http://localhost:3000

REM Wait a bit before starting receiver
timeout /t 2 /nobreak >nul

REM Start .NET receiver (runs in this window)
echo [2/2] Starting .NET receiver...
echo.
echo ========================================
echo Receiver is running. Press Ctrl+C to stop.
echo ========================================
echo.
cd /d %~dp0dotnet\VmmTrackerReceiver
dotnet run
