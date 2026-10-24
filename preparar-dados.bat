@echo off
rem Duplo clique: prepara os dados do painel de estatisticas (chama preparar-dados.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-dados.ps1" %*
echo.
pause
