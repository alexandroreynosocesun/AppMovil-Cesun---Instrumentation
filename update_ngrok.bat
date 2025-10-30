@echo off
echo 🔄 Actualizando URL de ngrok...

REM Obtener URL de ngrok
for /f "tokens=*" %%i in ('powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; $tunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' }; $tunnel.public_url } catch { Write-Host 'Error obteniendo URL de ngrok' }"') do set NGROK_URL=%%i

if "%NGROK_URL%"=="" (
    echo ❌ No se pudo obtener la URL de ngrok
    pause
    exit /b 1
)

echo 📍 URL encontrada: %NGROK_URL%

REM Actualizar archivos
echo 🔄 Actualizando archivos de servicios...

powershell -Command "Get-ChildItem 'mobile\src\services\*.js' | ForEach-Object { $content = Get-Content $_.FullName; $newContent = $content -replace 'https://[^/]+\.ngrok-free\.app', '%NGROK_URL%'; Set-Content $_.FullName $newContent; Write-Host 'Actualizado:' $_.Name }"

echo ✅ ¡Actualización completada!
echo 🎉 La aplicación móvil ahora usa: %NGROK_URL%/api
pause
