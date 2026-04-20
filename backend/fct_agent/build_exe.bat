@echo off
echo Instalando dependencias...
pip install mss pillow requests pytesseract opencv-python numpy pyinstaller

echo.
echo Compilando detect_zones.exe...
pyinstaller --onefile --console --name detect_zones detect_zones.py

echo.
echo Compilando fct_agent.exe...
pyinstaller --onefile --noconsole --name fct_agent fct_agent.py

echo.
echo ══════════════════════════════════════════
echo  LISTO:
echo    dist\detect_zones.exe
echo    dist\fct_agent.exe
echo.
echo  PRIMER USO — detectar coordenadas:
echo  1. Abre la pantalla FCT en la PC FCT
echo  2. Corre: detect_zones.exe
echo     Genera deteccion.png y deteccion.txt
echo  3. Abre deteccion.png e identifica
echo     las coordenadas de OK, NG y Pass%
echo  4. Edita CONFIG en fct_agent.py con
echo     esas coordenadas y vuelve a compilar
echo.
echo  PRODUCCION:
echo  5. Corre: fct_agent.exe
echo ══════════════════════════════════════════
pause
