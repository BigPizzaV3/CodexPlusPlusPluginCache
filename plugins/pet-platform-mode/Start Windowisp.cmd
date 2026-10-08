@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0game-mode.ps1" -Action On
if errorlevel 1 (
  echo.
  echo Windowisp could not start. Press any key to close this window.
  pause >nul
)
endlocal
