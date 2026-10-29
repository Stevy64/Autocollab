"""Choix d'environnement de l'API. Le développement et la production importent ceci.

L'API n'est pas publiée. Le frontal l'appelle en HTTP sur le loopback
(``WAYIZE_API_URL``). ``WAYIZE_HOSTS``, qui nomme le site public, ne s'applique
pas ici : un mauvais partage de fichier d'environnement ne doit pas faire
refuser ``127.0.0.1``.
"""

import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured

CLE_DEV = "dev-only-wayize-api-not-for-production"


def _liste(nom):
    return [morceau.strip() for morceau in os.environ.get(nom, "").split(",") if morceau.strip()]


def secret(prod):
    """``DJANGO_SECRET_KEY`` de ce processus. Elle peut différer de celle du frontal."""
    valeur = os.environ.get("DJANGO_SECRET_KEY", "").strip()
    if prod and (len(valeur) < 32 or valeur == CLE_DEV or valeur.startswith("dev-only-")):
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY est obligatoire en production "
            "(32 caractères ou plus, autre que la clé de développement)."
        )
    return valeur or CLE_DEV


def hotes(prod):
    """Hôtes de l'appel frontal → API. Défaut prod : loopback, pas le nom public."""
    choisis = _liste("WAYIZE_API_HOSTS")
    if choisis:
        return choisis
    if prod:
        return ["127.0.0.1", "localhost"]
    return ["*"]


def base_de_donnees(base_dir):
    """SQLite tant que ``DATABASE_URL`` est vide.

    SQLite reste le fichier local et convient à un seul processus API.
    Dès qu'il y a deux processus, ou un cluster, ``DATABASE_URL`` pointe
    vers PostgreSQL (``postgres://`` ou ``postgresql://``).
    """
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        brut = os.environ.get("WAYIZE_SQLITE_PATH", "").strip()
        chemin = Path(brut) if brut else Path(base_dir) / "db.sqlite3"
        return {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": chemin,
            }
        }
    analyse = urlparse(url)
    if analyse.scheme not in ("postgres", "postgresql"):
        raise ImproperlyConfigured("DATABASE_URL doit commencer par postgres:// ou postgresql://.")
    nom = unquote(analyse.path.lstrip("/"))
    if not analyse.hostname or not nom or not analyse.username:
        raise ImproperlyConfigured(
            "DATABASE_URL doit contenir l'utilisateur, l'hôte et le nom de la base."
        )
    config = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": nom,
        "USER": unquote(analyse.username),
        "PASSWORD": unquote(analyse.password or ""),
        "HOST": analyse.hostname,
        "PORT": str(analyse.port or 5432),
        "CONN_MAX_AGE": 60,
    }
    mode = parse_qs(analyse.query).get("sslmode", [""])[0]
    if mode:
        config["OPTIONS"] = {"sslmode": mode}
    return {"default": config}
