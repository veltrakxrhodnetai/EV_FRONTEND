@echo off
REM Simple backend startup script without auto-compilation
REM Use this if start-dev.bat has issues

echo.
echo Starting EV CSMS Backend...
echo.

cd /d "%~dp0..\backend"

REM Check if JAR exists
if not exist "target\ev-csms-backend-0.0.1-SNAPSHOT.jar" (
    echo ERROR: Backend JAR not found!
    echo.
    echo Please compile the backend first:
    echo   cd backend
    echo   mvnw.cmd clean package -DskipTests
    echo.
    pause
    exit /b 1
)

echo Starting database...
cd /d "%~dp0..\infra"
docker-compose up -d postgres
timeout /t 5 /nobreak

echo.
echo Starting backend on port 8080...
echo Backend URL: http://localhost:8080
echo.

cd /d "%~dp0..\backend"

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

pause
