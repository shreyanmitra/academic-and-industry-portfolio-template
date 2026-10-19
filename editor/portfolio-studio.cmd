@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-portfolio-studio.ps1" %*
if errorlevel 1 pause
