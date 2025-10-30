@echo off
echo 🔄 Reiniciando solo Expo (manteniendo Backend y Ngrok)...

echo.
echo 1️⃣ Obteniendo URL actual de ngrok...
for /f "tokens=*" %%i in ('powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; $tunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' }; $tunnel.public_url } catch { Write-Host 'Error' }"') do set NGROK_URL=%%i

if not "%NGROK_URL%"=="" (
    echo 📍 URL de ngrok: %NGROK_URL%
    echo 🔄 Actualizando archivos de servicios...
    
    powershell -Command "Get-ChildItem 'mobile\src\services\*.js' | ForEach-Object { $content = Get-Content $_.FullName; $newContent = $content -replace 'https://[^/]+\.ngrok-free\.app', '%NGROK_URL%'; Set-Content $_.FullName $newContent }"
    
    echo ✅ URLs actualizadas
) else (
    echo ❌ No se pudo obtener la URL de ngrok
    echo 💡 Asegúrate de que ngrok esté ejecutándose
    pause
    exit /b 1
)

echo.
echo 2️⃣ Reiniciando Expo...
start "Expo" cmd /k "cd mobile && npx expo start"

echo ✅ ¡Expo reiniciado con la URL actual de ngrok!
pause
