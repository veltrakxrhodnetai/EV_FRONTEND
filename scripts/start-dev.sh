#!/bin/bash
# =========================================================================
# EV CSMS - Full Development Environment Startup (macOS/Linux)
# =========================================================================
# This script starts PostgreSQL and the Spring Boot backend locally.
#
# Prerequisites:
#   - Docker installed and running
#   - Java 17+ installed
#
# Usage: ./start-dev.sh
# =========================================================================

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║    EV CSMS - Development Environment Startup                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if Docker is running
echo "[1/4] Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Docker is not running!"
    echo "Please start Docker and try again."
    echo ""
    exit 1
fi
echo "✓ Docker is running"

# Start PostgreSQL
echo ""
echo "[2/4] Starting PostgreSQL database..."
cd "$PROJECT_ROOT/infra"

if ! docker-compose up -d postgres; then
    echo "ERROR: Failed to start PostgreSQL"
    exit 1
fi
echo "✓ PostgreSQL started"

# Wait for database to be healthy
echo ""
echo "[3/4] Waiting for database to be ready..."
sleep 3

for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U evuser -d evcsms >/dev/null 2>&1; then
        echo "✓ Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "WARNING: Database may not be fully ready, but continuing..."
    fi
    sleep 1
done

# Compile and start backend
echo ""
echo "[4/4] Starting Spring Boot Backend..."
cd "$PROJECT_ROOT/backend"

if [ ! -f "target/ev-csms-backend-0.0.1-SNAPSHOT.jar" ]; then
    echo "Backend not compiled. Building now (this may take ~30 seconds)..."
    echo ""
    if ! ./mvnw clean package -DskipTests -q; then
        echo ""
        echo "ERROR: Maven compilation failed."
        echo "Please fix errors and try again."
        exit 1
    fi
    echo "✓ Backend compiled successfully"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓ Backend starting on port 8080...                           ║"
echo "║                                                                ║"
echo "║  API Base URL:  http://localhost:8080                         ║"
echo "║  Health Check:  http://localhost:8080/actuator/health         ║"
echo "║  Database UI:   http://localhost:8081 (adminer)               ║"
echo "║                                                                ║"
echo "║  Press Ctrl+C to stop the backend                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Set environment variables
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/evcsms
export SPRING_DATASOURCE_USERNAME=evuser
export SPRING_DATASOURCE_PASSWORD=evpass
export SPRING_JPA_SHOW_SQL=false
export LOG_LEVEL=INFO
export SQL_LOG_LEVEL=WARN
export CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Run backend
java -jar "target/ev-csms-backend-0.0.1-SNAPSHOT.jar"

echo ""
echo "Backend stopped."
