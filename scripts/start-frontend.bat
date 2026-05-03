@echo off
REM Development script to run React frontend locally
REM Prerequisites: 
REM   - Node.js 18+ installed
REM   - npm dependencies installed (run: npm install)
REM   - Backend running on port 8080

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║    EV CSMS - Frontend Development Server                       ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Starting React development server...
echo.

cd /d "%~dp0..\frontend"

REM Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo Installing npm dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  ✓ Frontend starting on port 5173...                          ║
echo ║                                                                ║
echo ║  App URL:      http://localhost:5173                          ║
echo ║  Backend API:  http://localhost:8080                          ║
echo ║                                                                ║
echo ║  Press Ctrl+C to stop the server                              ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Start dev server
call npm run dev

pause
