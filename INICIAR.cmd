@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (echo Instala Node.js 24 o superior. & pause & exit /b 1)
node --disable-warning=ExperimentalWarning scripts/start.mjs
pause
