@echo off
REM Compile backend only - run this once, then use start-backend-simple.bat

echo.
echo Compiling EV CSMS Backend...
echo This will take 30-60 seconds...
echo.

cd /d "%~dp0..\backend"

echo Running Maven compile...
echo.

REM Try Maven wrapper with proper quoting
if exist "%~dp0..\backend\mvnw.cmd" (
    echo Using Maven Wrapper...
    cmd /c ""%~dp0..\backend\mvnw.cmd" clean package -DskipTests"
) else (
    echo Maven wrapper not found, trying global Maven...
    mvn clean package -DskipTests
)

if errorlevel 1 (
    echo.
    echo ERROR: Compilation failed!
    echo.
    echo WORKAROUND: Try compiling manually:
    echo   1. Open Command Prompt
    echo   2. cd "C:\EV veltrak\ev-csms\backend"
    echo   3. mvn clean package -DskipTests
    echo.
    echo If mvn is not found, install Maven from: https://maven.apache.org/download.cgi
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Backend compiled successfully.
echo ========================================
echo.
echo JAR location: backend\target\ev-csms-backend-0.0.1-SNAPSHOT.jar
echo.
echo Next steps:
echo   1. Run: scripts\start-dev.bat
echo   OR
echo   2. Run: scripts\start-backend-simple.bat
echo.
pause
