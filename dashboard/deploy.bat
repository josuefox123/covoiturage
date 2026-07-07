@echo off
echo ==============================================
echo  DEPLOIEMENT DU DASHBOARD ZEMY SUR N0C
echo ==============================================

echo [1/4] Compilation du projet (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo Erreur lors de la compilation !
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] Creation de l'archive ZIP...
if exist output.zip del output.zip
powershell -Command "Compress-Archive -Path .output -DestinationPath output.zip -Force"
if %errorlevel% neq 0 (
    echo Erreur lors de la creation du ZIP !
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Envoi sur le serveur via SCP...
echo Mots de passe demande : H6aYpcsK9NEzAm
scp -P 5022 output.zip ewnhmjym@node239-eu.n0c.com:/home/ewnhmjym/zemy/dashboard/
if %errorlevel% neq 0 (
    echo Erreur lors de l'envoi sur le serveur !
    pause
    exit /b %errorlevel%
)

echo.
echo [4/4] Decompression et redemarrage sur le serveur via SSH...
echo Mots de passe demande : H6aYpcsK9NEzAm
ssh -p 5022 ewnhmjym@node239-eu.n0c.com "cd /home/ewnhmjym/zemy/dashboard && rm -rf .output && unzip -q -o output.zip && rm output.zip && pkill -f 'node.*index.mjs' ; nohup /home/ewnhmjym/zemy/start_dashboard.sh > /home/ewnhmjym/zemy/logs/dashboard.log 2>&1 & echo '--- DEPLOIEMENT TERMINE AVEC SUCCES ---'"

echo.
echo Deploiement termine !
del output.zip
pause
