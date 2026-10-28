"""Réglages de l'API Wayizé. Comptes et listes sont dans l'application comptes."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "dev-only-wayize-api-not-for-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Libreville"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

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
