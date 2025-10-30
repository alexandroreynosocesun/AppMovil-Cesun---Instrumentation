@echo off
echo ========================================
echo    Iniciando Sistema de Validacion de Jigs
echo ========================================
echo.

echo [1/3] Iniciando Backend...
start "Backend" cmd /k "cd backend && python run.py"
timeout /t 3 /nobreak >nul

echo [2/3] Iniciando Frontend con Túnel...
start "Frontend" cmd /k "cd mobile && npx expo start --tunnel"
timeout /t 2 /nobreak >nul

echo [3/4] Iniciando ngrok...
start "Ngrok" cmd /k "ngrok http 8000"
timeout /t 3 /nobreak >nul

echo [4/4] Abriendo navegador para ngrok...
start http://localhost:4040
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo    Sistema iniciado correctamente
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: Expo con túnel activo
echo Ngrok: Túnel público para backend
echo Ngrok UI: http://localhost:4040
echo.
echo Presiona cualquier tecla para salir...
pause >nul



