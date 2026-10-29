"""Réglages de développement du frontal.

``python manage.py runserver 127.0.0.1:8647`` charge ce module.
La production est ``wayize_web.prod`` (variable ``DJANGO_SETTINGS_MODULE``).
"""

import os
from pathlib import Path

from .reglages import hotes, origines, secret

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = secret(prod=False)
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = hotes(prod=False)
CSRF_TRUSTED_ORIGINS = origines(prod=False)
WAYIZE_SERVICE = "web"
# Le frontal est le seul à parler à l'API. En local comme en prod, cette URL
# reste privée (loopback, ou le nom du service dans le cluster).
API_UPSTREAM = os.environ.get("WAYIZE_API_URL", "http://127.0.0.1:8648").rstrip("/")

INSTALLED_APPS = [
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "web.apps.WebConfig",
]

MIDDLEWARE = [
    "web.journal.JournalRequetes",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "wayize_web.urls"
WSGI_APPLICATION = "wayize_web.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

# Cookie signé : cette base ne contient pas les signalements.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Libreville"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = Path(os.environ["WAYIZE_STATIC_ROOT"]) if os.environ.get("WAYIZE_STATIC_ROOT") else BASE_DIR / "staticfiles"
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
