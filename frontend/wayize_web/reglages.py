"""Choix d'environnement du frontal. Le développement et la production importent ceci.

La production est le module ``wayize_web.prod``. Ce fichier ne suffit pas à
démarrer Django : il ne fait que lire les variables, sans valeur secrète.
"""

import os

from django.core.exceptions import ImproperlyConfigured

HOTE_PUBLIC = "wayize.gabomazone.com"
ORIGINE_PUBLIC = "https://wayize.gabomazone.com"
CLE_DEV = "dev-only-wayize-web-not-for-production"


def _liste(nom):
    return [morceau.strip() for morceau in os.environ.get(nom, "").split(",") if morceau.strip()]


def secret(prod):
    """``DJANGO_SECRET_KEY`` signe le cookie de session. En prod elle est obligatoire."""
    valeur = os.environ.get("DJANGO_SECRET_KEY", "").strip()
    if prod and (len(valeur) < 32 or valeur == CLE_DEV or valeur.startswith("dev-only-")):
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY est obligatoire en production "
            "(32 caractères ou plus, autre que la clé de développement)."
        )
    return valeur or CLE_DEV


def hotes(prod):
    """Hôtes publics acceptés par le frontal. ``*`` seulement hors production."""
    choisis = _liste("WAYIZE_HOSTS")
    if choisis:
        return choisis
    if prod:
        return [HOTE_PUBLIC]
    return ["*"]


def origines(prod):
    """Origines HTTPS de confiance pour les formulaires (console /admin/)."""
    choisis = _liste("WAYIZE_CSRF_ORIGINS")
    if choisis:
        return choisis
    if prod:
        return [ORIGINE_PUBLIC]
    return []


def securite_proxy():
    """nginx termine TLS. Le processus ne voit que HTTP sur 127.0.0.1.

    On fait confiance à ``X-Forwarded-Proto`` pour que Django traite la
    requête comme HTTPS (cookie, CSRF). On ne redirige pas ici : une sonde
    sur le loopback n'envoie pas cet en-tête et recevrait un 301.
    """
    return {
        "SECURE_PROXY_SSL_HEADER": ("HTTP_X_FORWARDED_PROTO", "https"),
        "USE_X_FORWARDED_HOST": True,
        "SESSION_COOKIE_SECURE": True,
        "CSRF_COOKIE_SECURE": True,
        "SECURE_SSL_REDIRECT": False,
    }
