#!/bin/sh
# Démarre l'API Wayizé. À lancer depuis backend/, comme start_backend.sh de Gabomazone.
set -e
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
python3 manage.py migrate
exec python3 manage.py runserver 127.0.0.1:8648
