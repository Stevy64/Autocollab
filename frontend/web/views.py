import json

from django.contrib.staticfiles import finders
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

from .amont import appeler, cadre
from .journal import journal


def _json(data, status=200):
    response = JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False})
    response["Cache-Control"] = "no-store"
    return response


@ensure_csrf_cookie
def index(request):
    boot = cadre(request)
    response = render(request, "trafic/index.html", {"boot": boot})
    response["Cache-Control"] = "no-store"
    return response


@require_GET
def manifest(request):
    payload = {
        "name": "Wayizé — Trafic à Libreville",
        "short_name": "Wayizé",
        "description": "Signalements de circulation à Libreville, partagés par les conducteurs.",
        "lang": "fr",
        "dir": "ltr",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#e7eaee",
        "theme_color": "#111111",
        "icons": [
            {
                "src": "/static/trafic/icons/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/static/trafic/icons/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/static/trafic/icons/icon-maskable-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
    }
    response = JsonResponse(payload, json_dumps_params={"ensure_ascii": False})
    response["Content-Type"] = "application/manifest+json"
    return response


@require_GET
def service_worker(request):
    path = finders.find("trafic/sw.js")
    if not path:
        return JsonResponse({"message": "Service worker introuvable."}, status=404)
    response = FileResponse(open(path, "rb"), content_type="application/javascript")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response


@require_GET
def sante(request):
    try:
        status, brut, _type = appeler(request, "/api/sante/", method="GET")
        api_ok = status == 200 and json.loads(brut.decode("utf-8")).get("ok") is True
    except Exception as exc:
        journal(
            "web",
            "error",
            level="error",
            request_id=getattr(request, "wayize_request_id", ""),
            path="/sante/",
            error=type(exc).__name__,
            message=str(exc),
        )
        api_ok = False
    return _json({"service": "web", "ok": True, "api": api_ok}, status=200 if api_ok else 503)


def proxy(request, reste):
    """Porte unique vers l'API. Ajoute la session anonyme, puis appelle WAYIZE_API_URL."""
    chemin = "/api/" + reste.lstrip("/")
    if request.path.endswith("/") and not chemin.endswith("/"):
        chemin += "/"
    if request.META.get("QUERY_STRING"):
        chemin = chemin + "?" + request.META["QUERY_STRING"]
    body = request.body if request.method not in ("GET", "HEAD") else None
    try:
        status, brut, type_contenu = appeler(
            request,
            chemin,
            method=request.method,
            body=body or None,
            content_type=request.content_type,
        )
    except Exception:
        return _json(
            {"message": "Le service des signalements ne répond pas pour le moment."},
            status=503,
        )
    response = HttpResponse(brut, status=status, content_type=type_contenu)
    response["Cache-Control"] = "no-store"
    return response
