#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs

echo "[1/4] Starting Docker services..."
docker compose up -d

echo "[2/4] Waiting for Postgres to become healthy..."
MAX_RETRIES=60
RETRY_DELAY=2
ATTEMPT=1

until docker compose exec -T postgres pg_isready -U evuser -d evcsms >/dev/null 2>&1; do
  if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
  echo "  - waiting for postgres ($ATTEMPT/$MAX_RETRIES)"
  ATTEMPT=$((ATTEMPT + 1))
  sleep "$RETRY_DELAY"
done

echo "Postgres is ready."

echo "[3/4] Starting backend..."
(
  cd backend
  ./mvnw spring-boot:run
) > logs/backend.log 2>&1 &
BACKEND_PID=$!

echo "[4/4] Starting frontend..."
(
  cd frontend
  npm run dev
) > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

shutdown() {
  echo
  echo "Graceful shutdown initiated..."

  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    echo "Stopping frontend (PID: $FRONTEND_PID)..."
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  echo "Stopping Docker services..."
  docker compose stop >/dev/null 2>&1 || true

  echo "Stopped."
  exit 0
}

trap shutdown INT TERM

echo

echo "Services are starting in background."
echo "Backend URL : http://localhost:8080"
echo "Frontend URL: http://localhost:5173"
echo "Logs:"
echo "  - logs/backend.log"
echo "  - logs/frontend.log"
echo
echo "Graceful shutdown instructions:"
echo "  - Press Ctrl+C in this terminal to stop backend/frontend and docker services gracefully."
echo "  - Or run: docker compose stop"
echo

wait
