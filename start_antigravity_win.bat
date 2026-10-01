@echo off
setlocal enabledelayedexpansion
title Antigravity Launcher with Debug Port

set PORTS=9222 9333 9444 9555 9666
set SELECTED_PORT=

for %%p in (%PORTS%) do (
    netstat -ano | find "LISTENING" | find ":%%p " >nul
    if errorlevel 1 (
        set SELECTED_PORT=%%p
        goto :found
    )
)

:notfound
echo [ERROR] No available debug ports were found (%PORTS%)
pause
exit /b 1

:found
echo [INFO] Detected available port: %SELECTED_PORT%
set "APP_PATH=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"

if exist "%APP_PATH%" (
    echo [INFO] Starting Antigravity from %APP_PATH%...
    start "" "%APP_PATH%" --remote-debugging-port=%SELECTED_PORT%
) else (
    echo [INFO] Trying PATH Antigravity.exe...
    start "" "Antigravity.exe" --remote-debugging-port=%SELECTED_PORT%
)

echo [OK] Antigravity launched on debug port: %SELECTED_PORT%
timeout /t 3 >nul
exit /b 0
