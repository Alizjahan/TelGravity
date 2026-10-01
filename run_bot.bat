@echo off
cd /d "%~dp0"
title Antigravity Telegram Remote - Dashboard

echo ===================================================
echo     ANTIRLM - Antigravity Telegram Remote
echo ===================================================
echo [Working Directory] %CD%
echo.

rem Check node installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

rem Clear any stale lock
if exist "%USERPROFILE%\.antigravity-telegram-remote\.bot.lock" (
    del /f /q "%USERPROFILE%\.antigravity-telegram-remote\.bot.lock" >nul 2>nul
)

rem Ensure shortcut with custom 3D app icon exists
if not exist "Antigravity Remote.lnk" (
    powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('Antigravity Remote.lnk'); $s.TargetPath = (Resolve-Path 'run_bot.bat').Path; $s.WorkingDirectory = (Resolve-Path '.').Path; if (Test-Path 'assets\app.ico') { $s.IconLocation = (Resolve-Path 'assets\app.ico').Path + ',0' }; $s.Save()" >nul 2>nul
)

echo [INFO] Launching Web UI Dashboard...
start "" http://127.0.0.1:3888

node dist\bin\cli.js ui

pause
