#!/bin/bash
# Exit on error
set -e

echo "Starting Celery worker in the background..."
celery -A app.core.celery_app worker --loglevel=info &

echo "Starting FastAPI server..."
# PORT is provided by Render automatically
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
