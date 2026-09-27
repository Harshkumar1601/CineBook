@echo off
title Stop All CineBook Services
echo Stopping all CineBook microservice Node.js processes...
taskkill /F /FI "WINDOWTITLE eq User Service :8001*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Movie Service :8002*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Show-Seat Service :8004*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Booking Service :8003*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Notification Service :8005*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq API Gateway :8000*" /T 2>nul
echo Done. All services stopped.
pause
