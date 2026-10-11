@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

:: ---- Lire le port depuis config-serveur.txt ----
set "PORT=3000"
for /f "usebackq tokens=1,* delims==" %%a in ("config-serveur.txt") do (
  if /i "%%a"=="PORT" set "PORT=%%b"
)
set "PORT=%PORT: =%"

echo.
echo   Arrêt du serveur de test...

:: ---- Méthode 1 : via le fichier serveur.pid ----
if exist "serveur.pid" (
  set /p PID=<"serveur.pid"
  echo   PID trouvé dans serveur.pid : %PID%
  taskkill /PID %PID% /F >nul 2>nul
  if !errorlevel! equ 0 (
    echo   [OK] Processus %PID% arrêté correctement.
  ) else (
    echo   [!] Impossible d'arrêter le PID %PID% — il est peut-être déjà arrêté.
  )
  del "serveur.pid" >nul 2>nul
  goto :confirmation
)

:: ---- Méthode 2 (secours) : tuer le processus sur le port ----
echo   Fichier serveur.pid introuvable. Recherche du processus sur le port %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  echo   PID trouvé sur le port : %%a
  taskkill /PID %%a /F >nul 2>nul
  if !errorlevel! equ 0 (
    echo   [OK] Processus %%a arrêté.
  )
)
goto :confirmation

:confirmation
if exist "serveur.pid" del "serveur.pid" >nul 2>nul
echo.
echo   [OK] Le serveur est arrêté. Fichier serveur.pid supprimé.
echo.
pause
