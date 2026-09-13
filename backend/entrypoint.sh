#!/usr/bin/env bash
set -e

echo "=== [LMS Backend] Starting entrypoint ==="

# Run seeding script (which also waits for DB and creates all tables)
echo "=== [LMS Backend] Running database initialization and seeding ==="
python seed.py

echo "=== [LMS Backend] Launching Uvicorn server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
