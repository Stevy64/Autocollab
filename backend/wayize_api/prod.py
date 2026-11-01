"""Réglages de production de l'API. Elle n'écoute pas sur Internet.

``DJANGO_SETTINGS_MODULE=wayize_api.prod``

gunicorn la lie à 127.0.0.1:8648, ou au réseau interne du cluster.
Un seul worker tant que le magasin est SQLite. PostgreSQL (``DATABASE_URL``)
est le magasin dès qu'il y a plus d'un processus.
"""

import os
from pathlib import Path

from .reglages import base_de_donnees, hotes, secret

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = secret(prod=True)
DEBUG = False
ALLOWED_HOSTS = hotes(prod=True)
WAYIZE_SERVICE = "api"

INSTALLED_APPS = [
    "apps.signalements.apps.SignalementsConfig",
    "apps.appuis.apps.AppuisConfig",
    "apps.commentaires.apps.CommentairesConfig",
    "apps.lieux.apps.LieuxConfig",
    "apps.comptes.apps.ComptesConfig",
    "apps.pilotage.apps.PilotageConfig",
]

MIDDLEWARE = [
    "apps.journal.JournalRequetes",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "wayize_api.urls"
WSGI_APPLICATION = "wayize_api.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

DATABASES = base_de_donnees(BASE_DIR)

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Libreville"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

EMAIL_BACKEND = os.environ.get(
    "WAYIZE_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get("WAYIZE_EMAIL_FROM", "wayize@localhost")
WAYIZE_PUBLIC_URL = os.environ.get("WAYIZE_PUBLIC_URL", "http://127.0.0.1:8647").rstrip("/")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "wayize": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
