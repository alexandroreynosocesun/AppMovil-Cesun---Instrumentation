@echo off
chcp 65001 >nul
echo ============================================
echo   INSTALAR SERVICIO WINDOWS - UPH OCR
echo ============================================
echo.
echo Este script requiere ejecutarse como ADMINISTRADOR
echo.

cd /d "%~dp0"

set EXE=%~dp0dist\fase2_ocr_cliente.exe
set SERVICIO=UPH_OCR_L6
set NSSM=%~dp0nssm.exe

:: Verificar que existe el exe
if not exist "%EXE%" (
    echo [ERROR] No se encontro: %EXE%
    echo Ejecuta primero build_ocr_exe.bat
    pause
    exit /b 1
)

:: Verificar NSSM (Non-Sucking Service Manager)
if not exist "%NSSM%" (
    echo [INFO] Descargando NSSM...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile nssm.zip"
    powershell -Command "Expand-Archive -Path nssm.zip -DestinationPath nssm_tmp -Force"
    copy nssm_tmp\nssm-2.24\win64\nssm.exe nssm.exe >nul
    rmdir /s /q nssm_tmp
    del nssm.zip
)

:: Desinstalar si ya existe
"%NSSM%" status %SERVICIO% >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Desinstalando servicio anterior...
    "%NSSM%" stop %SERVICIO% >nul 2>&1
    "%NSSM%" remove %SERVICIO% confirm >nul 2>&1
)

:: Instalar servicio
echo [INFO] Instalando servicio %SERVICIO%...
"%NSSM%" install %SERVICIO% "%EXE%"
"%NSSM%" set %SERVICIO% AppDirectory "%~dp0dist"
"%NSSM%" set %SERVICIO% DisplayName "UPH OCR Cliente - Linea 6"
"%NSSM%" set %SERVICIO% Description "Captura pantalla y envia eventos UPH al servidor"
"%NSSM%" set %SERVICIO% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICIO% AppStdout "%~dp0logs\ocr_stdout.log"
"%NSSM%" set %SERVICIO% AppStderr "%~dp0logs\ocr_stderr.log"
"%NSSM%" set %SERVICIO% AppRotateFiles 1
"%NSSM%" set %SERVICIO% AppRotateSeconds 86400

:: Crear carpeta de logs
if not exist logs mkdir logs

:: Iniciar servicio
echo [INFO] Iniciando servicio...
"%NSSM%" start %SERVICIO%

echo.
echo ============================================
echo   Servicio instalado: %SERVICIO%
echo   Estado:
"%NSSM%" status %SERVICIO%
echo.
echo   Para detener:   nssm stop %SERVICIO%
echo   Para iniciar:   nssm start %SERVICIO%
echo   Para remover:   nssm remove %SERVICIO% confirm
echo   Logs en:        %~dp0logs\
echo ============================================
pause
