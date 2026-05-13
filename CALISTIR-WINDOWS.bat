@echo off
cd /d "%~dp0"
echo.
echo TDK Lingo baslatiliyor...
echo Klasor: %CD%
echo.

if not exist package.json (
  echo HATA: package.json bu klasorde yok.
  echo Bu .bat dosyasini zipten cikan lingo-tdk-local klasorunun icinde calistirin.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo HATA: npm bulunamadi. Once Node.js LTS kurun: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Ilk kurulum yapiliyor: npm install
  npm install
  if errorlevel 1 (
    echo npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

echo.
echo Tarayicida acilacak adres genelde: http://127.0.0.1:5173
echo Cikmak icin terminalde Ctrl+C yapin.
echo.
npm run dev
pause
