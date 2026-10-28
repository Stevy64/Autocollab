"""Appels HTTP du frontal vers l'API, sur le modèle du proxy /api de Gabomazone."""

import json
import re
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .journal import journal

_CLE = re.compile(r"^[A-Za-z0-9]{8,64}$")

CADRE_SECOURS = {
    "lieux": [],
    "types": [],
    "centre": {"latitude": 0.408, "longitude": 9.453, "zoom": 13},
    "bornes": {"sud": 0.25, "ouest": 9.30, "nord": 0.56, "est": 9.58},
    "erreur": True,
}


def identite(request):
    """Clé anonyme propre au navigateur. Ce n'est pas le cookie signé, et elle n'est pas journalisée."""
    cle = request.session.get("cle") or ""
    if not _CLE.match(cle):
        cle = secrets.token_hex(16)
        request.session["cle"] = cle
    return cle


def appeler(request, chemin, method=None, body=None, content_type=None):
    """chemin commence par /api/. Retourne (status, octets, content_type)."""
    method = method or request.method
    request_id = getattr(request, "wayize_request_id", "") or ""
    url = settings.API_UPSTREAM + chemin
    headers = {
        "Accept": "application/json",
        "X-Request-Id": request_id,
        "X-Wayize-Session": identite(request),
    }
    data = body
    if data:
        headers["Content-Type"] = content_type or "application/json"
    requete = Request(url, data=data, headers=headers, method=method)
    debut = time.perf_counter()
    try:
        with urlopen(requete, timeout=8) as upstream:
            brut = upstream.read()
            status = upstream.status
            type_contenu = upstream.headers.get("Content-Type", "application/json")
    except HTTPError as exc:
        brut = exc.read()
        status = exc.code
        type_contenu = exc.headers.get("Content-Type", "application/json")
    except (URLError, TimeoutError, OSError) as exc:
        journal(
            "web",
            "boundary.error",
            level="error",
            request_id=request_id,
            target="api",
            method=method,
            path=chemin,
            error=type(exc).__name__,
            message=str(getattr(exc, "reason", exc)),
        )
        raise
    journal(
        "web",
        "boundary.call",
        request_id=request_id,
        target="api",
        method=method,
        path=chemin.split("?", 1)[0],
        status=status,
        ms=round((time.perf_counter() - debut) * 1000),
    )
    return status, brut, type_contenu


def cadre(request):
    try:
        status, brut, _type = appeler(request, "/api/carte/", method="GET")
    except (URLError, TimeoutError, OSError):
        return dict(CADRE_SECOURS)
    if status != 200:
        journal(
            "web",
            "boundary.error",
            level="error",
            request_id=getattr(request, "wayize_request_id", ""),
            target="api",
            path="/api/carte/",
            status=status,
        )
        return dict(CADRE_SECOURS)
    try:
        data = json.loads(brut.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return dict(CADRE_SECOURS)
    if not isinstance(data, dict) or "lieux" not in data or "centre" not in data:
        return dict(CADRE_SECOURS)
    return data
