@echo off
REM =========================================================================
REM EV CSMS - Full Development Environment Startup
REM =========================================================================
REM This script starts PostgreSQL and the Spring Boot backend locally.
REM
REM Prerequisites:
REM   - Docker Desktop installed and running
REM   - Java 17+ installed
REM
REM Usage: Just run this script and it will:
REM   1. Start PostgreSQL in Docker
REM   2. Wait for database to be ready
REM   3. Compile backend (if not compiled)
REM   4. Start Spring Boot on port 8080
REM   5. Display API URLs
REM
REM =========================================================================

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║    EV CSMS - Development Environment Startup                   ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Check if Docker is running
echo [1/4] Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Docker is not running or not installed!
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo ✓ Docker is running

REM Start PostgreSQL
echo.
echo [2/4] Starting PostgreSQL database...
cd /d "%~dp0..\infra"

docker-compose up -d postgres
if errorlevel 1 (
    echo ERROR: Failed to start PostgreSQL
    pause
    exit /b 1
)
echo ✓ PostgreSQL started

REM Wait for database to be healthy
echo.
echo [3/4] Waiting for database to be ready...
timeout /t 3 /nobreak

docker-compose exec -T postgres pg_isready -U evuser -d evcsms >nul 2>&1
set db_ready=0
for /L %%i in (1,1,30) do (
    docker-compose exec -T postgres pg_isready -U evuser -d evcsms >nul 2>&1
    if !errorlevel! equ 0 (
        set db_ready=1
        goto db_ready
    )
    timeout /t 1 /nobreak >nul
)

:db_ready
if !db_ready! equ 1 (
    echo ✓ Database is ready
) else (
    echo WARNING: Database may not be fully ready, but continuing...
)

REM Compile and start backend
echo.
echo [4/4] Starting Spring Boot Backend...
cd /d "%~dp0..\backend"

if not exist "target\ev-csms-backend-0.0.1-SNAPSHOT.jar" (
    echo.
    echo Backend not compiled. Building now - this may take ~30 seconds...
    echo.
    call mvnw.cmd clean package -DskipTests
    if errorlevel 1 (
        echo.
        echo ERROR: Maven compilation failed.
        echo Please fix errors and try again.
        pause
        exit /b 1
    )
    echo.
    echo ✓ Backend compiled successfully
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  ✓ Backend starting on port 8080...                           ║
echo ║                                                                ║
echo ║  API Base URL:  http://localhost:8080                         ║
echo ║  Health Check:  http://localhost:8080/actuator/health         ║
echo ║  Database UI:   http://localhost:8081 (adminer)               ║
echo ║                                                                ║
echo ║  Press Ctrl+C to stop the backend                             ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Set environment variables
set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/evcsms"
set "SPRING_DATASOURCE_USERNAME=evuser"
set "SPRING_DATASOURCE_PASSWORD=evpass"
set "SPRING_JPA_SHOW_SQL=false"
set "LOG_LEVEL=INFO"
set "SQL_LOG_LEVEL=WARN"
set "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000"
set "MSG91_ENABLED=true"
set "MSG91_AUTH_KEY=500086Axgw0hbj69e8a5a9P1"
set "MSG91_TEMPLATE_ID=69e8c993b6c8931b61090803"
set "MSG91_COUNTRY_CODE=91"
set "OTP_SMS_REQUIRED=true"
set "OTP_ALLOW_DEV_TEST=false"

REM Run backend
java -jar "target\ev-csms-backend-0.0.1-SNAPSHOT.jar"

echo.
echo Backend stopped.
pause
