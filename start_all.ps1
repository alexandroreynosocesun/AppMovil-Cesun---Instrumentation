# Script para ejecutar todo el sistema de Validación de Jigs
# Ejecutar con: powershell -ExecutionPolicy Bypass -File start_all.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    SISTEMA DE VALIDACION DE JIGS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para actualizar URLs en los archivos de servicios
function Update-API-URLs {
    param([string]$newUrl)
    
    Write-Host "🔄 Actualizando URLs en los servicios..." -ForegroundColor Yellow
    
    $services = @(
        "mobile/src/services/AdminService.js",
        "mobile/src/services/AuthService.js", 
        "mobile/src/services/JigService.js",
        "mobile/src/services/ValidationService.js",
        "mobile/src/services/ReportService.js",
        "mobile/src/services/JigNGService.js"
    )
    
    foreach ($service in $services) {
        if (Test-Path $service) {
            $content = Get-Content $service -Raw
            $content = $content -replace "const API_BASE_URL = 'https://[^']+';", "const API_BASE_URL = '$newUrl';"
            Set-Content $service $content
            Write-Host "✅ Actualizado: $service" -ForegroundColor Green
        }
    }
}

# Función para obtener la URL de ngrok
function Get-Ngrok-URL {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing -TimeoutSec 5
        $data = $response.Content | ConvertFrom-Json
        $url = $data.tunnels[0].public_url
        return $url
    }
    catch {
        Write-Host "⚠️  No se pudo obtener la URL de ngrok automáticamente" -ForegroundColor Yellow
        return $null
    }
}

Write-Host "[1/3] Iniciando Backend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; python run.py" -WindowStyle Normal

Write-Host "[2/3] Iniciando ngrok..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 8000" -WindowStyle Normal

Write-Host "⏳ Esperando que ngrok se inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Intentar obtener la URL de ngrok y actualizar los archivos
$ngrokUrl = Get-Ngrok-URL
if ($ngrokUrl) {
    $apiUrl = "$ngrokUrl/api"
    Update-API-URLs $apiUrl
    Write-Host "✅ URLs actualizadas a: $apiUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️  No se pudo obtener la URL de ngrok. Actualiza manualmente los archivos de servicios." -ForegroundColor Yellow
}

Write-Host "[3/3] Iniciando App Movil (Expo)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\mobile'; npx expo start" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    TODOS LOS SERVICIOS INICIADOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "ngrok: http://localhost:4040" -ForegroundColor Green
Write-Host "App: Se abrirá en el navegador" -ForegroundColor Green
if ($ngrokUrl) {
    Write-Host "URL Pública: $ngrokUrl" -ForegroundColor Green
}
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
