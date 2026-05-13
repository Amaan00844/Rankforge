@echo off
echo ========================================
echo   RankForge - Local Development Setup
echo ========================================

echo.
echo [1/5] Starting Docker services (Postgres, Redis, Qdrant)...
cd docker
docker compose up -d
cd ..

echo Waiting for services to be ready...
timeout /t 8 /nobreak > nul

echo.
echo [2/5] Setting up Python backend...
cd backend

if not exist ".env" (
    copy .env.example .env
    echo.
    echo *** IMPORTANT: Edit backend\.env and add your NVIDIA_API_KEY ***
    echo     NVIDIA_API_KEY=nvapi-your-key-here
    echo.
    pause
)

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating venv and installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo.
echo [3/5] Installing Playwright browsers...
playwright install chromium --with-deps 2>nul || echo Playwright install skipped (optional)

echo.
echo [4/5] Starting FastAPI backend on http://localhost:8000 ...
start "RankForge Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

cd ..

echo.
echo [5/5] Setting up React frontend...
cd frontend

if not exist "node_modules" (
    echo Installing npm packages...
    npm install
)

echo Starting Vite dev server on http://localhost:5173 ...
start "RankForge Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

cd ..

echo.
echo ========================================
echo   RankForge is starting up!
echo ========================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo   Qdrant UI: http://localhost:6333/dashboard
echo.
echo   Register at http://localhost:5173/login
echo ========================================
pause
