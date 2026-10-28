"""Pages de la console. Le jeton reste dans la session, jamais dans le HTML."""

import json
from urllib.error import URLError
from urllib.parse import urlencode

from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods, require_POST

from .amont import _JETON, appeler


def _jeton(request):
    brut = request.session.get("admin_jeton") or ""
    return brut if _JETON.match(brut) else ""


def _oublier(request):
    for cle in ("admin_jeton", "admin_email", "admin_id"):
        request.session.pop(cle, None)


def _flash(request, texte, erreur=False):
    request.session["admin_flash"] = {"texte": str(texte)[:240], "erreur": bool(erreur)}


def _prendre_flash(request):
    flash = request.session.pop("admin_flash", None)
    if isinstance(flash, dict) and flash.get("texte"):
        return flash
    return None


def _html(request, template, context, status=200):
    response = render(request, template, context, status=status)
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "same-origin"
    return response


def _api(request, chemin, method="GET", payload=None, garder_jeton=False):
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    try:
        status, brut, _type = appeler(
            request,
            chemin,
            method=method,
            body=body,
            jeton=_jeton(request),
        )
    except (URLError, TimeoutError, OSError):
        return 503, {"message": "Le service des signalements ne répond pas pour le moment."}
    try:
        data = json.loads(brut.decode("utf-8")) if brut else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    jeton = data.pop("jeton", "") or ""
    if garder_jeton and _JETON.match(str(jeton)):
        data["_jeton"] = jeton
    return status, data


def _garde(request):
    if not _jeton(request):
        return redirect("admin-connexion")
    return None


def _refuser(request, status, data):
    if status in (401, 403):
        _oublier(request)
        _flash(request, data.get("message") or "Connectez-vous pour continuer.", erreur=True)
        return redirect("admin-connexion")
    return None


def _coquille(request, nav):
    email = request.session.get("admin_email") or ""
    return {
        "nav": nav,
        "email": email,
        "initiale": (email[:1] or "W").upper(),
        "moi": request.session.get("admin_id") or 0,
        "flash": _prendre_flash(request),
        "panne": "",
        "erreur": "",
    }


def _entier(valeur, bas, haut, defaut):
    try:
        n = int(valeur)
    except (TypeError, ValueError):
        return defaut
    return max(bas, min(haut, n))


def _borne_saisie(valeur, bas, haut):
    try:
        n = int(str(valeur).strip())
    except (TypeError, ValueError):
        return None
    if n < bas or n > haut:
        return None
    return n


def _reglages(data):
    data = data if isinstance(data, dict) else {}
    return {
        "duree_heures": _entier(data.get("duree_heures"), 1, 12, 3),
        "seuil_degage": _entier(data.get("seuil_degage"), 2, 5, 2),
        "plafond_heure": _entier(data.get("plafond_heure"), 1, 24, 8),
    }


def _jours(lignes):
    propre = []
    if not isinstance(lignes, list):
        return propre
    for ligne in lignes:
        if not isinstance(ligne, dict):
            continue
        propre.append(
            {
                "label": str(ligne.get("label") or "")[:8],
                "n": _entier(ligne.get("n"), 0, 100000, 0),
                "pct": _entier(ligne.get("pct"), 0, 100, 0),
                "date": str(ligne.get("date") or "")[:10],
            }
        )
    return propre


def _types(lignes):
    propre = []
    if not isinstance(lignes, list):
        return propre
    for ligne in lignes:
        if not isinstance(ligne, dict):
            continue
        propre.append(
            {
                "id": str(ligne.get("id") or "")[:32],
                "label": str(ligne.get("label") or "")[:40],
                "n": _entier(ligne.get("n"), 0, 100000, 0),
            }
        )
    return propre


@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def connexion(request):
    if request.method == "GET":
        if _jeton(request):
            return redirect("admin-apercu")
        return _html(
            request,
            "admin/connexion.html",
            {"flash": _prendre_flash(request), "erreur": "", "email": ""},
        )
    email = (request.POST.get("email") or "").strip()
    mot = request.POST.get("mot_de_passe") or ""
    status, data = _api(
        request,
        "/api/admin/entree/",
        method="POST",
        payload={"email": email, "mot_de_passe": mot},
        garder_jeton=True,
    )
    jeton = data.pop("_jeton", "")
    compte = data.get("compte") if isinstance(data.get("compte"), dict) else {}
    if status == 200 and compte.get("est_admin") and _JETON.match(jeton):
        request.session.cycle_key()
        request.session["admin_jeton"] = jeton
        request.session["admin_email"] = str(compte.get("email") or "")[:254]
        request.session["admin_id"] = _entier(compte.get("id"), 0, 10**12, 0)
        return redirect("admin-apercu")
    return _html(
        request,
        "admin/connexion.html",
        {
            "flash": _prendre_flash(request),
            "erreur": data.get("message") or "Connexion impossible.",
            "email": email,
        },
    )


@require_POST
def sortie(request):
    _oublier(request)
    return redirect("admin-connexion")


@ensure_csrf_cookie
def apercu(request):
    refus = _garde(request)
    if refus:
        return refus
    status, data = _api(request, "/api/admin/apercu/")
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    ctx = _coquille(request, "apercu")
    if status != 200:
        ctx["panne"] = data.get("message") or "Lecture impossible."
        ctx["vide"] = True
        return _html(request, "admin/apercu.html", ctx)
    ctx.update(
        {
            "vide": False,
            "signalements_n": _entier(data.get("signalements"), 0, 100000, 0),
            "comptes_n": _entier(data.get("comptes"), 0, 100000, 0),
            "premium_n": _entier(data.get("premium"), 0, 100000, 0),
            "admins_n": _entier(data.get("admins"), 0, 100000, 0),
            "appuis_n": _entier(data.get("appuis"), 0, 100000, 0),
            "degages_n": _entier(data.get("degages"), 0, 100000, 0),
            "en_retrait": _entier(data.get("en_retrait"), 0, 100000, 0),
            "par_type": _types(data.get("par_type")),
            "semaine": _jours(data.get("semaine")),
            "reglages": _reglages(data.get("reglages")),
        }
    )
    return _html(request, "admin/apercu.html", ctx)


def _ligne_signalement(ligne):
    if not isinstance(ligne, dict):
        return None
    return {
        "id": _entier(ligne.get("id"), 1, 10**12, 0),
        "type_label": str(ligne.get("type_label") or "")[:40],
        "lieu": str(ligne.get("lieu") or "")[:120],
        "extrait": str(ligne.get("extrait") or "")[:160],
        "appuis": _entier(ligne.get("appuis"), 0, 100000, 0),
        "degages": _entier(ligne.get("degages"), 0, 100000, 0),
        "quand": str(ligne.get("quand") or "")[:24],
        "relatif": str(ligne.get("relatif") or "")[:40],
    }


@ensure_csrf_cookie
def signalements(request):
    refus = _garde(request)
    if refus:
        return refus
    params = {}
    type_filtre = (request.GET.get("type") or "").strip()[:32]
    q = " ".join((request.GET.get("q") or "").split())[:80]
    if type_filtre:
        params["type"] = type_filtre
    if q:
        params["q"] = q
    chemin = "/api/admin/signalements/"
    if params:
        chemin += "?" + urlencode(params)
    status, data = _api(request, chemin)
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    ctx = _coquille(request, "signalements")
    if status != 200:
        ctx["panne"] = data.get("message") or "Lecture impossible."
        ctx["lignes"] = []
        ctx["types"] = []
        ctx["filtre"] = {"type": type_filtre, "q": q}
        return _html(request, "admin/signalements.html", ctx)
    lignes = []
    for brute in data.get("signalements") or []:
        ligne = _ligne_signalement(brute)
        if ligne and ligne["id"]:
            lignes.append(ligne)
    ctx.update(
        {
            "lignes": lignes,
            "total": len(lignes),
            "types": _types(data.get("types")),
            "filtre": {
                "type": str((data.get("filtre") or {}).get("type") or type_filtre)[:32],
                "q": str((data.get("filtre") or {}).get("q") or q)[:80],
            },
        }
    )
    return _html(request, "admin/signalements.html", ctx)


def _retour_liste(request):
    params = {}
    type_filtre = (request.POST.get("type") or "").strip()[:32]
    q = " ".join((request.POST.get("q") or "").split())[:80]
    if type_filtre:
        params["type"] = type_filtre
    if q:
        params["q"] = q
    if not params:
        return "/admin/signalements/"
    return "/admin/signalements/?" + urlencode(params)


@require_POST
def retirer(request, pk):
    refus = _garde(request)
    if refus:
        return refus
    status, data = _api(
        request,
        f"/api/admin/signalements/{pk}/retirer/",
        method="POST",
        payload={},
    )
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    if status == 200 and data.get("retire"):
        _flash(request, "Signalement retiré de la carte.")
    else:
        _flash(request, data.get("message") or "Le signalement n'a pas pu être retiré.", erreur=True)
    return redirect(_retour_liste(request))


def _ligne_compte(ligne):
    if not isinstance(ligne, dict):
        return None
    return {
        "id": _entier(ligne.get("id"), 1, 10**12, 0),
        "email": str(ligne.get("email") or "")[:254],
        "premium": bool(ligne.get("premium")),
        "est_admin": bool(ligne.get("est_admin")),
        "quand": str(ligne.get("quand") or "")[:24],
    }


@ensure_csrf_cookie
def comptes(request):
    refus = _garde(request)
    if refus:
        return refus
    status, data = _api(request, "/api/admin/comptes/")
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    ctx = _coquille(request, "comptes")
    if status != 200:
        ctx["panne"] = data.get("message") or "Lecture impossible."
        ctx["lignes"] = []
        ctx["admins_n"] = 0
        return _html(request, "admin/comptes.html", ctx)
    lignes = []
    for brute in data.get("comptes") or []:
        ligne = _ligne_compte(brute)
        if ligne and ligne["id"]:
            lignes.append(ligne)
    ctx.update(
        {
            "lignes": lignes,
            "admins_n": _entier(data.get("admins"), 0, 100000, 0),
        }
    )
    return _html(request, "admin/comptes.html", ctx)


@require_POST
def compte(request, pk):
    refus = _garde(request)
    if refus:
        return refus
    status, data = _api(
        request,
        f"/api/admin/comptes/{pk}/",
        method="POST",
        payload={
            "premium": request.POST.get("premium") == "1",
            "est_admin": request.POST.get("est_admin") == "1",
        },
    )
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    if status == 200:
        _flash(request, "Compte mis à jour.")
    else:
        _flash(request, data.get("message") or "Le compte n'a pas pu être modifié.", erreur=True)
    return redirect("admin-comptes")


@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def reglages(request):
    refus = _garde(request)
    if refus:
        return refus
    if request.method == "POST":
        saisi = {
            "duree_heures": (request.POST.get("duree_heures") or "").strip(),
            "seuil_degage": (request.POST.get("seuil_degage") or "").strip(),
            "plafond_heure": (request.POST.get("plafond_heure") or "").strip(),
        }
        duree = _borne_saisie(saisi["duree_heures"], 1, 12)
        seuil = _borne_saisie(saisi["seuil_degage"], 2, 5)
        plafond = _borne_saisie(saisi["plafond_heure"], 1, 24)
        if None in (duree, seuil, plafond):
            ctx = _coquille(request, "reglages")
            ctx["erreur"] = "Vérifiez les bornes : durée 1–12 h, votes « dégagé » 2–5, plafond 1–24."
            ctx["reglages"] = {
                "duree_heures": saisi["duree_heures"] or 3,
                "seuil_degage": saisi["seuil_degage"] or 2,
                "plafond_heure": saisi["plafond_heure"] or 8,
            }
            return _html(request, "admin/reglages.html", ctx)
        status, data = _api(
            request,
            "/api/admin/reglages/",
            method="POST",
            payload={"duree_heures": duree, "seuil_degage": seuil, "plafond_heure": plafond},
        )
        bounce = _refuser(request, status, data)
        if bounce:
            return bounce
        if status == 200:
            _flash(request, "Réglages enregistrés. La carte les applique tout de suite.")
            return redirect("admin-reglages")
        ctx = _coquille(request, "reglages")
        ctx["erreur"] = data.get("message") or "Enregistrement impossible."
        ctx["reglages"] = _reglages(data if "duree_heures" in data else saisi)
        return _html(request, "admin/reglages.html", ctx)
    status, data = _api(request, "/api/admin/reglages/")
    bounce = _refuser(request, status, data)
    if bounce:
        return bounce
    ctx = _coquille(request, "reglages")
    ctx["erreur"] = ""
    if status != 200:
        ctx["panne"] = data.get("message") or "Lecture impossible."
        ctx["reglages"] = _reglages({})
        return _html(request, "admin/reglages.html", ctx)
    ctx["reglages"] = _reglages(data)
    return _html(request, "admin/reglages.html", ctx)
