@echo off
title CineBook - Microservices Ticket Booking System
echo ============================================
echo  CineBook Microservices - Starting All Services
echo ============================================
echo.

set ROOT=D:\B.Tech 1st year\Sem-7\MAP\Practical-7\ticket-booking-microservices

echo [1/6] Starting User Service (port 8001)...
start "User Service :8001" cmd /k "cd /d "%ROOT%\user-service" && node src/server.js"
timeout /t 2 /nobreak > nul

echo [2/6] Starting Movie Service (port 8002)...
start "Movie Service :8002" cmd /k "cd /d "%ROOT%\movie-service" && node src/server.js"
timeout /t 2 /nobreak > nul

echo [3/6] Starting Show-Seat Service (port 8004)...
start "Show-Seat Service :8004" cmd /k "cd /d "%ROOT%\show-seat-service" && node src/server.js"
timeout /t 2 /nobreak > nul

echo [4/6] Starting Booking Service (port 8003)...
start "Booking Service :8003" cmd /k "cd /d "%ROOT%\booking-service" && node src/server.js"
timeout /t 3 /nobreak > nul

echo [5/6] Starting Notification Service (port 8005)...
start "Notification Service :8005" cmd /k "cd /d "%ROOT%\notification-service" && node src/server.js"
timeout /t 2 /nobreak > nul

echo [6/6] Starting API Gateway (port 8000)...
start "API Gateway :8000" cmd /k "cd /d "%ROOT%\api-gateway" && node src/server.js"
timeout /t 3 /nobreak > nul

echo.
echo ============================================
echo  All 6 services launched!
echo ============================================
echo.
echo  API Gateway:          http://localhost:8000
echo  GraphQL Playground:   http://localhost:8000/graphql
echo  User Service:         http://localhost:8001
echo  Movie Service:        http://localhost:8002
echo  Booking Service:      http://localhost:8003
echo  Show-Seat Service:    http://localhost:8004
echo  Notification Service: http://localhost:8005
echo  RabbitMQ Management:  http://localhost:15672
echo.
echo  Open frontend\index.html in your browser!
echo ============================================
pause
