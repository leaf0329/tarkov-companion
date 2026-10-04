@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts/refresh.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0停止助手.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动助手.ps1"
if errorlevel 1 pause
