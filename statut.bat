@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   === STATUT DU SERVEUR ===
echo.
if exist "serveur.pid" (
  set /p PID_EXIST=<"serveur.pid"
  tasklist /FI "PID eq %PID_EXIST%" 2>nul | findstr /I /C:"%PID_EXIST%" >nul
  if %errorlevel% equ 0 (echo État EN LIGNE & echo PID %PID_EXIST%) else (echo État HORS LIGNE & del "serveur.pid")
) else (echo État HORS LIGNE)
echo.
echo Utilisez allumer.bat / eteindre.bat.
pause
