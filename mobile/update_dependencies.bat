@echo off
echo Actualizando dependencias para SDK 54...
echo.

echo Eliminando node_modules y package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo Instalando dependencias actualizadas...
npm install

echo.
echo Instalando dependencias específicas de Expo...
npx expo install --fix

echo.
echo Actualización completada!
echo Ahora puedes ejecutar: npx expo start
pause
