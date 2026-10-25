#!/usr/bin/env bash
set -e

# ==============================================================================
# Blockchain Consensus Failure Simulator - Startup Script
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
VENV_DIR="${BACKEND_DIR}/venv"

echo "=========================================================================="
echo " Starting Blockchain Consensus Failure Simulator"
echo "=========================================================================="

# 1. Environment & Library Path check
if [ -d "${PROJECT_ROOT}/lib" ]; then
    export LD_LIBRARY_PATH="${PROJECT_ROOT}/lib:${LD_LIBRARY_PATH}"
fi

# 2. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 could not be found. Please install Python 3.11 or newer."
    exit 1
fi
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "[OK] Found Python ${PYTHON_VERSION}"

# 3. Check Node.js and npm
if ! command -v node &> /dev/null; then
    echo "[ERROR] node could not be found. Please install Node.js 18 or newer."
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm could not be found. Please install npm."
    exit 1
fi
NODE_VERSION=$(node -v)
echo "[OK] Found Node ${NODE_VERSION} and npm $(npm -v)"

# 4. Setup Python Virtual Environment
if [ ! -d "${VENV_DIR}" ]; then
    echo "[INFO] Creating Python virtual environment in ${VENV_DIR}..."
    python3 -m venv "${VENV_DIR}"
fi

# 5. Install backend dependencies if not installed
echo "[INFO] Checking backend dependencies..."
if ! "${VENV_DIR}/bin/python" -c "import fastapi, uvicorn, pydantic, pytest" &> /dev/null; then
    echo "[INFO] Installing backend dependencies from requirements.txt..."
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
else
    echo "[OK] Backend dependencies verified."
fi

# 6. Install frontend dependencies if needed
if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    (cd "${FRONTEND_DIR}" && npm install)
else
    echo "[OK] Frontend dependencies verified."
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "[INFO] Shutting down Blockchain Consensus Simulator..."
    if [ -n "${BACKEND_PID}" ]; then
        kill "${BACKEND_PID}" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID}" ]; then
        kill "${FRONTEND_PID}" 2>/dev/null || true
    fi
    echo "[INFO] All services stopped gracefully."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 7. Start Backend Service
echo "[INFO] Starting FastAPI Backend on http://0.0.0.0:8000..."
cd "${PROJECT_ROOT}"
export PYTHONPATH="${PROJECT_ROOT}"
"${VENV_DIR}/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend health check
echo "[INFO] Waiting for backend to initialize..."
HEALTH_URL="http://127.0.0.1:8000/api/health"
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if curl -s "${HEALTH_URL}" | grep -q "ok"; then
        echo "[OK] Backend is healthy and operational."
        break
    fi
    sleep 0.5
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "[ERROR] Backend failed to start within 15 seconds."
    exit 1
fi

# 8. Start Frontend Service
echo "[INFO] Starting Vite Frontend on http://0.0.0.0:5173..."
cd "${FRONTEND_DIR}"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

sleep 1

echo "=========================================================================="
echo " CONSENSUS SIMULATOR SERVICES READY"
echo "=========================================================================="
echo " • Frontend Dashboard:    http://localhost:5173"
echo " • Backend API Docs:      http://localhost:8000/docs"
echo " • REST API Root:         http://localhost:8000/api"
echo " • Live WebSocket Feed:   ws://localhost:8000/ws"
echo "=========================================================================="
echo " Press Ctrl+C to stop all services."
echo "=========================================================================="

# Keep running
wait
