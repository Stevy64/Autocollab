#!/bin/sh
# Démarre la carte. À lancer depuis frontend/, comme start_frontend.sh de Gabomazone.
set -e
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
export WAYIZE_API_URL="${WAYIZE_API_URL:-http://127.0.0.1:8648}"
exec python3 manage.py runserver 0.0.0.0:8647
