@echo off
echo Configurando entorno con Python 3.11...

REM Eliminar entorno virtual anterior si existe
if exist venv rmdir /s /q venv

REM Crear nuevo entorno virtual con Python 3.11
py -3.11 -m venv venv

REM Activar entorno virtual
call venv\Scripts\activate

REM Actualizar pip
python -m pip install --upgrade pip

REM Instalar dependencias
pip install -r requirements.txt

echo.
echo ✅ Entorno configurado correctamente con Python 3.11
echo.
echo Para activar el entorno en el futuro, ejecuta:
echo call venv\Scripts\activate
echo.
echo Para ejecutar el servidor:
echo python run.py
echo.
pause

