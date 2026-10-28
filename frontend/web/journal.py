"""Même forme de journal que l'API, pour le processus frontal."""

import json
import logging
import time
import uuid
from datetime import datetime, timezone

from django.conf import settings

log = logging.getLogger("wayize")

_CLES_INTERDITES = (
    "secret",
    "password",
    "passwd",
    "token",
    "cookie",
    "csrf",
    "session",
    "authorization",
    "cle",
    "jeton",
    "email",
    "mot_de_passe",
)


def _sensible(nom):
    bas = str(nom).lower()
    return any(mot in bas for mot in _CLES_INTERDITES)


def journal(service, event, level="info", **champs):
    secret = str(getattr(settings, "SECRET_KEY", "") or "")
    propre = {}
    for nom, valeur in champs.items():
        if _sensible(nom):
            continue
        if isinstance(valeur, str) and secret and secret in valeur:
            valeur = valeur.replace(secret, "[redige]")
        if isinstance(valeur, str) and len(valeur) > 240:
            valeur = valeur[:240] + "…"
        propre[nom] = valeur
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "level": level.upper(),
        "service": service,
        "event": event,
        **propre,
    }
    ligne = json.dumps(payload, ensure_ascii=False, default=str)
    if secret and secret in ligne:
        ligne = ligne.replace(secret, "[redige]")
    niveau = "warning" if level == "warning" else level
    getattr(log, niveau)(ligne)


class JournalRequetes:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/static/"):
            return self.get_response(request)
        recu = request.headers.get("X-Request-Id", "")
        request.wayize_request_id = recu[:32] if recu else uuid.uuid4().hex[:16]
        debut = time.perf_counter()
        try:
            response = self.get_response(request)
        except Exception as exc:
            journal(
                "web",
                "error",
                level="error",
                request_id=request.wayize_request_id,
                method=request.method,
                path=request.path,
                error=type(exc).__name__,
                message=str(exc),
            )
            raise
        response["X-Request-Id"] = request.wayize_request_id
        journal(
            "web",
            "http.request",
            request_id=request.wayize_request_id,
            method=request.method,
            path=request.path,
            status=response.status_code,
            ms=round((time.perf_counter() - debut) * 1000),
        )
        return response
