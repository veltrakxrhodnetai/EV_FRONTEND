@echo off
REM Simple backend runner that works around path space issues

echo Starting EV CSMS Backend...
echo.
echo Make sure PostgreSQL is running: cd infra ^&^& docker-compose up -d postgres
echo.

REM Navigate to backend
cd /d "%~dp0..\backend"

REM Set environment variables
set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/evcsms"
set "SPRING_DATASOURCE_USERNAME=evuser"
set "SPRING_DATASOURCE_PASSWORD=evpass"
set "SPRING_JPA_SHOW_SQL=true"
set "LOG_LEVEL=DEBUG"
set "SQL_LOG_LEVEL=DEBUG"
set "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000"
set "MSG91_ENABLED=true"
set "MSG91_AUTH_KEY=500086Axgw0hbj69e8a5a9P1"
set "MSG91_TEMPLATE_ID=69e8c993b6c8931b61090803"
set "MSG91_COUNTRY_CODE=91"
set "OTP_SMS_REQUIRED=true"
set "OTP_ALLOW_DEV_TEST=false"

echo Environment configured. Starting Spring Boot...
echo.

REM Use PowerShell to run mvnw (better handling of paths with spaces)
powershell -ExecutionPolicy Bypass -Command "& { $env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/evcsms'; $env:SPRING_DATASOURCE_USERNAME='evuser'; $env:SPRING_DATASOURCE_PASSWORD='evpass'; $env:SPRING_JPA_SHOW_SQL='true'; $env:LOG_LEVEL='DEBUG'; $env:SQL_LOG_LEVEL='DEBUG'; $env:CORS_ALLOWED_ORIGINS='http://localhost:5173,http://localhost:3000'; $env:MSG91_ENABLED='true'; $env:MSG91_AUTH_KEY='500086Axgw0hbj69e8a5a9P1'; $env:MSG91_TEMPLATE_ID='69e8c993b6c8931b61090803'; $env:MSG91_COUNTRY_CODE='91'; $env:OTP_SMS_REQUIRED='true'; $env:OTP_ALLOW_DEV_TEST='false'; & '%~dp0..\backend\mvnw.cmd' spring-boot:run }"

pause
