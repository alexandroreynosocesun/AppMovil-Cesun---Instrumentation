@echo off
chcp 65001 >nul
echo ============================================
echo   BUILD UPH OCR - PyInstaller
echo ============================================

cd /d "%~dp0"

set PYTHON=%~dp0backend\venv\Scripts\python.exe
set PYINST=%~dp0backend\venv\Scripts\pyinstaller.exe

:: Verificar venv
if not exist "%PYTHON%" (
    echo [ERROR] No se encontro el venv en backend\venv
    pause
    exit /b 1
)

:: Limpiar builds anteriores
if exist dist\configurador_zonas.exe del /q dist\configurador_zonas.exe
if exist dist\fase2_ocr_cliente.exe  del /q dist\fase2_ocr_cliente.exe
if exist build rmdir /s /q build
if exist __pycache__ rmdir /s /q __pycache__

echo.
echo [1/2] Compilando configurador_zonas.exe ...
"%PYINST%" --noconfirm --onefile --windowed ^
    --name "configurador_zonas" ^
    --distpath dist ^
    --workpath build ^
    --specpath build ^
    configurador_zonas.py

echo.
echo [2/2] Compilando fase2_ocr_cliente.exe ...
"%PYINST%" --noconfirm --onefile --console ^
    --name "fase2_ocr_cliente" ^
    --distpath dist ^
    --workpath build ^
    --specpath build ^
    fase2_ocr_cliente.py

echo.
echo ============================================
if exist dist\fase2_ocr_cliente.exe (
    echo   BUILD EXITOSO
    echo.
    echo   Archivos generados en dist\:
    echo     configurador_zonas.exe  - Configura zonas por PC
    echo     fase2_ocr_cliente.exe   - Captura y envia datos
    echo.
    echo   Flujo de despliegue:
    echo     1. Copia dist\ a la PC de produccion
    echo     2. Ejecuta configurador_zonas.exe una vez
    echo     3. Ejecuta fase2_ocr_cliente.exe o instala como servicio
) else (
    echo   ERROR en el build
)
echo ============================================
pause