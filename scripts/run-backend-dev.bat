@echo off
REM Development script to run Spring Boot backend locally
REM Prerequisites: 
REM   - Start PostgreSQL with: cd infra && docker-compose up -d postgres
REM   - Ensure Java 17+ is installed

echo Starting EV CSMS Backend in Development Mode...
echo.
echo Prerequisites Check:
echo - Checking if PostgreSQL is running...
echo - If not, run: cd infra ^&^& docker-compose up -d postgres
echo.

cd /d "%~dp0..\backend"

REM Check if JAR exists, if not compile it
if not exist "target\ev-csms-backend-0.0.1-SNAPSHOT.jar" (
    echo.
    echo JAR not found. Compiling backend...
    echo Running: mvn clean package -DskipTests
    echo.
    call mvnw clean package -DskipTests
    if errorlevel 1 (
        echo.
        echo ERROR: Maven compilation failed. Please fix errors above and try again.
        pause
        exit /b 1
    )
)

REM Set development environment variables
set SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/evcsms
set SPRING_DATASOURCE_USERNAME=evuser
set SPRING_DATASOURCE_PASSWORD=evpass
set SPRING_JPA_SHOW_SQL=true
set LOG_LEVEL=DEBUG
set SQL_LOG_LEVEL=DEBUG
set CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
set MSG91_ENABLED=true
set MSG91_AUTH_KEY=500086Axgw0hbj69e8a5a9P1
set MSG91_TEMPLATE_ID=69e8c993b6c8931b61090803
set MSG91_COUNTRY_CODE=91
set OTP_SMS_REQUIRED=true
set OTP_ALLOW_DEV_TEST=false

if "%MSG91_AUTH_KEY%"=="" echo WARNING: MSG91_AUTH_KEY is not set. OTP SMS requests will fail with 502.
if "%MSG91_TEMPLATE_ID%"=="" echo WARNING: MSG91_TEMPLATE_ID is not set. OTP SMS requests will fail with 502.

echo.
echo Running Spring Boot Backend on port 8080...
echo.
echo Backend URL: http://localhost:8080
echo API Docs: http://localhost:8080/swagger-ui.html
echo.
echo Note: To rebuild, run: cd backend ^&^& mvn clean package
echo.

REM Run the compiled JAR
java -jar "target\ev-csms-backend-0.0.1-SNAPSHOT.jar"

pause

