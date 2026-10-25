#!/usr/bin/env bash
# Blockchain Consensus Failure Simulator - Master Runner Script
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${PROJECT_DIR}"
export LD_LIBRARY_PATH="${PROJECT_DIR}/lib:${LD_LIBRARY_PATH}"

echo "=========================================================="
echo "  ConsensusPulse: Blockchain Consensus Failure Simulator"
echo "=========================================================="

show_help() {
  echo "Usage: ./run.sh [backend|frontend|both|test|build]"
  echo ""
  echo "Commands:"
  echo "  both       (default) Start both Backend (:8000) and Frontend (:5173)"
  echo "  backend    Start FastAPI backend server on http://localhost:8000"
  echo "  frontend   Start Vite React frontend on http://localhost:5173"
  echo "  test       Execute the full 19-test automated pytest suite"
  echo "  build      Build frontend production distribution (dist/)"
  echo ""
}

MODE="${1:-both}"

case "${MODE}" in
  backend)
    echo "Starting Backend server on http://0.0.0.0:8000..."
    "${PROJECT_DIR}/backend/venv/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8000 --reload
    ;;

  frontend)
    echo "Starting Frontend Vite server on http://0.0.0.0:5173..."
    cd "${PROJECT_DIR}/frontend"
    npm run dev -- --host 0.0.0.0 --port 5173
    ;;

  both)
    echo "Starting Backend (port 8000) and Frontend (port 5173)..."
    echo "Press Ctrl+C to stop both servers."

    trap 'kill $(jobs -p) 2>/dev/null' EXIT

    "${PROJECT_DIR}/backend/venv/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!

    cd "${PROJECT_DIR}/frontend"
    npm run dev -- --host 0.0.0.0 --port 5173 &
    FRONTEND_PID=$!

    echo ""
    echo "✓ Backend API:     http://localhost:8000"
    echo "✓ Swagger Docs:    http://localhost:8000/docs"
    echo "✓ Frontend UI:     http://localhost:5173"
    echo ""

    wait
    ;;

  test)
    echo "Running pytest test suite (19 tests)..."
    "${PROJECT_DIR}/backend/venv/bin/pytest" "${PROJECT_DIR}/backend/tests/" -v
    ;;

  build)
    echo "Compiling Frontend production bundle..."
    cd "${PROJECT_DIR}/frontend"
    npm run build
    ;;

  *)
    show_help
    exit 1
    ;;
esac
