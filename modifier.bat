@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   Modification de la configuration
echo   ==================================
echo.
echo   - config-site.txt : textes et apparence du site.
echo     Les changements sont IMMÉDIATS : il suffit de rafraîchir la page (F5).
echo.
echo   - config-serveur.txt : réglages du serveur (port, hôte...).
echo     Les changements nécessitent d'arrêter puis relancer le serveur :
echo       1. eteindre.bat
echo       2. modifier.bat   ^(vous êtes en train de l'ouvrir^)
echo       3. allumer.bat
echo.
echo   Ouverture des fichiers dans le Bloc-notes...

start "" notepad "config-site.txt"
start "" notepad "config-serveur.txt"

echo.
echo   Les fichiers sont ouverts. Modifiez-les, puis fermez le Bloc-notes.
echo.
pause
