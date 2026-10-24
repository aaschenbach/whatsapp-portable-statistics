@echo off
rem Duplo clique: copia o painel de estatisticas para um pendrive ou pasta (chama copiar-painel.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0copiar-painel.ps1" %*
echo.
pause
