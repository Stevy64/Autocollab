"""Réponses JSON partagées par les applications de l'API."""

import json
import math
from functools import wraps

from django.db.utils import OperationalError, ProgrammingError
from django.http import JsonResponse

from .journal import journal, request_id

TAILLE_MAX_REQUETE = 8000


def reponse(data, status=200):
    response = JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False})
    response["Cache-Control"] = "no-store"
    return response


def erreur(message=None, champs=None, status=400):
    payload = {}
    if message:
        payload["message"] = message
    if champs:
        payload["erreurs"] = champs
    return reponse(payload, status=status)


def protege(service):
    def decorateur(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            try:
                return view(request, *args, **kwargs)
            except (OperationalError, ProgrammingError) as exc:
                journal(
                    service,
                    "error",
                    level="error",
                    request_id=request_id(request),
                    method=request.method,
                    path=request.path,
                    error=type(exc).__name__,
                    message=str(exc),
                )
                return erreur(
                    "La base locale n'est pas prête. Lancez « python manage.py migrate » dans backend/.",
                    status=503,
                )

        return wrapper

    return decorateur


def texte_propre(valeur):
    if not isinstance(valeur, str):
        return ""
    return " ".join(valeur.replace("\x00", " ").split())


def nombre(valeur):
    try:
        n = float(valeur)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(n):
        return None
    return n


def lire_json(request, taille=TAILLE_MAX_REQUETE):
    if len(request.body) > taille:
        return None, "Le message est trop volumineux."
    if not request.body:
        return {}, None
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, "Le format envoyé n'est pas du JSON valide."
    if not isinstance(data, dict):
        return None, "Le format envoyé n'est pas reconnu."
    return data, None
