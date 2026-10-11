@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal EnableDelayedExpansion

:: ---- Vérifier Node.js ----
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo   [ERREUR] Node.js n'est pas installé.
  echo   Téléchargez-le sur https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: ---- Lire PORT (ignorer commentaires #) ----
set "PORT=3000"
for /f "usebackq delims=" %%i in ("config-serveur.txt") do (
  set "LINE=%%i"
  if not "!LINE:~0,1!=="#" if not "!LINE!=="" (
    for /f "tokens=1,2 delims==" %%a in ("!LINE!") do (
      if /i "%%a"=="PORT" set "PORT=%%b"
    )
  )
)
set "PORT=%PORT: =%"
if "%PORT%"=="" set "PORT=3000"

:: ---- Vérifier serveur déjà lancé (PID réel) ----
if exist "serveur.pid" (
  set /p PID_EXIST=<"serveur.pid"
  set "PID_EXIST=%PID_EXIST: =%"
  tasklist /FI "PID eq %PID_EXIST%" 2>nul | findstr /I /C:"%PID_EXIST%" >nul
  if %errorlevel% equ 0 (
    echo.
    echo   [INFO] Le serveur est déjà en ligne (PID %PID_EXIST%) sur le port %PORT%.
    echo.
    start "" "http://localhost:%PORT%"
    echo   [OK] Navigateur ouvert vers http://localhost:%PORT%.
    echo.
    pause
    exit /b 0
  ) else (
    echo   [AVERTISSEMENT] serveur.pid périmé (PID %PID_EXIST% introuvable). Suppression...
    del "serveur.pid" >nul 2>nul
  )
)

:: ---- Démarrer en arrière-plan (cmd /c pour garder fenêtre) ----
echo.
echo   [LANCEMENT] Démarrage du serveur de test sur le port %PORT%...
echo.
start "Serveur de test" /min cmd /c "node server.js >> serveur.log 2>&1"

:: ---- Attendre jusqu'à 10 s, tester /api/health chaque seconde ----
set /a TENTATIVES=0
:attente
set /a TENTATIVES+=1
if %TENTATIVES% gtr 10 goto erreur
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0} else {exit 1} } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto succes
timeout /t 1 /nobreak >nul
goto attente

:succes
echo.
echo   [OK] Le serveur est EN LIGNE sur http://localhost:%PORT%.
echo   PID : (écrit par server.js dans serveur.pid)
echo.
start "" "http://localhost:%PORT%"
echo   Navigateur ouvert sur http://localhost:%PORT%.
echo.
echo   Utilisez eteindre.bat pour arrêter.
echo.
pause
exit /b 0

:erreur
echo.
echo   [ERREUR] Le serveur n'a pas démarré après 10 secondes.
echo.
echo   --- 15 dernières lignes de serveur.log ---
if exist "serveur.log" (
  type "serveur.log" 2>nul | findstr /N "." | findstr "/[0-9]*:[0-9]*:[0-9]*" 2>nul | findstr /V "^$" | tail -n 15 2>nul || echo   (voir fichier)
)
echo.
echo   Causes probables :
echo     - Port %PORT% déjà utilisé.
echo     - Node.js non trouvé.
echo     - server.js manquant ou erreur de syntaxe.
echo.
pause
exit /b 1
