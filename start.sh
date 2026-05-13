#!/bin/bash
set -e

echo "========================================"
echo "  RankForge - Local Development Setup"
echo "========================================"

echo ""
echo "[1/5] Starting Docker services (Postgres, Redis, Qdrant)..."
cd docker
docker compose up -d
cd ..

echo "Waiting for services to be ready..."
sleep 8

echo ""
echo "[2/5] Setting up Python backend..."
cd backend

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "*** IMPORTANT: Edit backend/.env and add your NVIDIA_API_KEY ***"
    echo "    NVIDIA_API_KEY=nvapi-your-key-here"
    echo ""
    read -p "Press Enter after you've added your API key..."
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt -q

echo ""
echo "[3/5] Installing Playwright (optional)..."
playwright install chromium --with-deps 2>/dev/null || echo "Playwright skipped (httpx fallback will be used)"

echo ""
echo "[4/5] Starting FastAPI backend..."
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

cd ..

echo ""
echo "[5/5] Setting up React frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "========================================"
echo "  RankForge is running!"
echo "========================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Qdrant UI: http://localhost:6333/dashboard"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "========================================"

trap "kill $BACKEND_PID $FRONTEND_PID; docker compose -f docker/docker-compose.yml down" EXIT
wait
