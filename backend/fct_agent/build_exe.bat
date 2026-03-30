@echo off
echo Instalando dependencias...
pip install mss pillow requests pyinstaller

echo Compilando fct_agent.exe...
pyinstaller --onefile --noconsole --name fct_agent fct_agent.py

echo.
echo Listo. El .exe esta en: dist\fct_agent.exe
echo Copialo a la PC FCT y ejecutalo.
pause
