#!/bin/bash
# Development script to run React frontend locally (macOS/Linux)
# Prerequisites: 
#   - Node.js 18+ installed
#   - npm dependencies installed (run: npm install)
#   - Backend running on port 8080

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║    EV CSMS - Frontend Development Server                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting React development server..."
echo ""

# Get script directory and navigate to frontend
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing npm dependencies..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: npm install failed"
        exit 1
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓ Frontend starting on port 5173...                          ║"
echo "║                                                                ║"
echo "║  App URL:      http://localhost:5173                          ║"
echo "║  Backend API:  http://localhost:8080                          ║"
echo "║                                                                ║"
echo "║  Press Ctrl+C to stop the server                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Start dev server
npm run dev
