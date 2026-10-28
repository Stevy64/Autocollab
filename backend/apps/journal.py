"""Journaux d'exploitation. Une ligne JSON par événement, sans secret."""

import json
import logging
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
)


def request_id(request):
    return getattr(request, "wayize_request_id", "") or ""


def _sensible(nom):
    bas = str(nom).lower()
    return any(mot in bas for mot in _CLES_INTERDITES)


def _valeur(valeur, secret):
    if isinstance(valeur, str):
        if secret and secret in valeur:
            valeur = valeur.replace(secret, "[redige]")
        if len(valeur) > 240:
            return valeur[:240] + "…"
    return valeur


def journal(service, event, level="info", **champs):
    secret = str(getattr(settings, "SECRET_KEY", "") or "")
    propre = {}
    for nom, valeur in champs.items():
        if _sensible(nom):
            continue
        propre[nom] = _valeur(valeur, secret)
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
    """Trace chaque requête métier et les exceptions, avec un identifiant commun."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/static/"):
            return self.get_response(request)
        import uuid

        recu = request.headers.get("X-Request-Id", "")
        request.wayize_request_id = recu[:32] if recu else uuid.uuid4().hex[:16]
        debut = __import__("time").perf_counter()
        try:
            response = self.get_response(request)
        except Exception as exc:
            journal(
                getattr(settings, "WAYIZE_SERVICE", "api"),
                "error",
                level="error",
                request_id=request.wayize_request_id,
                method=request.method,
                path=request.path,
                error=type(exc).__name__,
                message=str(exc),
            )
            raise
        duree = round((__import__("time").perf_counter() - debut) * 1000)
        response["X-Request-Id"] = request.wayize_request_id
        journal(
            getattr(settings, "WAYIZE_SERVICE", "api"),
            "http.request",
            request_id=request.wayize_request_id,
            method=request.method,
            path=request.path,
            status=response.status_code,
            ms=duree,
        )
        return response
