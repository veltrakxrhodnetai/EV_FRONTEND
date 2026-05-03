@echo off
REM Workaround build script for admin module

echo Compiling admin module...

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "%~dp0..\backend"

REM Find all admin-related Java files  
set "SRC_PATH=src\main\java"
set "TARGET_PATH=target\classes"

REM Compile new admin classes
echo Compiling AdminLoginRequest.java...
javac -cp "target\classes;%USERPROFILE%\.m2\repository\jakarta\validation\jakarta.validation-api\3.0.2\jakarta.validation-api-3.0.2.jar" ^
  -d "%TARGET_PATH%" ^
  "%SRC_PATH%\com\evcsms\backend\dto\AdminLoginRequest.java"

javac -cp "target\classes;%USERPROFILE%\.m2\repository\jakarta\validation\jakarta.validation-api\3.0.2\jakarta.validation-api-3.0.2.jar" ^
  -d "%TARGET_PATH%" ^
  "%SRC_PATH%\com\evcsms\backend\dto\ResetPasswordRequest.java"

echo.
echo Compilation complete. Now rebuild the JAR manually or run from IDE.
echo.
echo TO REBUILD FROM IDE:
echo   1. Open project in IntelliJ IDEA / Eclipse / VS Code
echo   2. Right-click project root
echo   3. Select "Maven" ^> "Reload Project" or "Build" ^> "Rebuild Project"
echo   4. Or run: Build ^> Rebuild Project
echo.
pause
