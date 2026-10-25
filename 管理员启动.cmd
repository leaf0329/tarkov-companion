@echo off
setlocal
chcp 65001 >nul
start "" "%~dp0runtime\launcher\launcher.exe" "%~dp0."
exit /b
