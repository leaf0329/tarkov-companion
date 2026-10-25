@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=1
"%~dp0runtime\electron\electron.exe" "%~dp0scripts\cache-catalog.mjs"
pause
