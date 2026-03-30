@echo off
echo Instalando dependencias...
pip install mss pillow requests winocr pyinstaller

echo.
echo Compilando fct_agent.exe...
pyinstaller --onefile --noconsole --name fct_agent fct_agent.py

echo.
echo ══════════════════════════════════════════
echo  LISTO: dist\fct_agent.exe
echo.
echo  Pasos:
echo  1. Copia fct_agent.exe a la PC FCT
echo  2. Primero corre: fct_agent.exe --calibrar
echo     Esto genera calibracion.png — verifica
echo     que las zonas esten sobre los valores
echo  3. Si esta bien, corre: fct_agent.exe
echo ══════════════════════════════════════════
pause
