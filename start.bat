@echo off
cd /d "%~dp0"
if not exist node_modules\lamejs (
  echo Installing required files...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo ITZIK SOUND is starting...
echo Keep this window open while using the website.
echo.
call npm start
pause