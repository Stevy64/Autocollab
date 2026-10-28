import json
import math
from datetime import timedelta
from functools import wraps

from django.contrib.staticfiles import finders
from django.db import IntegrityError, transaction
from django.db.utils import OperationalError, ProgrammingError
from django.db.models import Count, Prefetch
from django.http import FileResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .geo import CENTRE, EST, LIEUX, NORD, OUEST, SUD, dans_libreville
from .models import Appui, Commentaire, Signalement
from .present import signalement_public, tendance

MAX_PAR_HEURE = 8
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


def protege(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except (OperationalError, ProgrammingError):
            return erreur(
                "La base locale n'est pas prête. Lancez « python manage.py migrate ».",
                status=503,
            )

    return wrapper


def cle_session(request):
    if not request.session.session_key:
        request.session["pret"] = True
        request.session.save()
    return request.session.session_key


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


def lire_json(request):
    if len(request.body) > TAILLE_MAX_REQUETE:
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


def base_signalements():
    return (
        Signalement.objects.annotate(appui_count=Count("appuis"))
        .prefetch_related(
            Prefetch(
                "commentaires",
                queryset=Commentaire.objects.order_by("-cree_le"),
                to_attr="notes_recentes",
            )
        )
        .order_by("-cree_le")
    )


def ids_appuyes(request, identifiants):
    cle = request.session.session_key
    if not cle or not identifiants:
        return set()
    return set(
        Appui.objects.filter(session_cle=cle, signalement_id__in=identifiants).values_list(
            "signalement_id",
            flat=True,
        )
    )


def charger(pk):
    return base_signalements().get(pk=pk)


@ensure_csrf_cookie
def index(request):
    try:
        request.session["pret"] = True
    except (OperationalError, ProgrammingError):
        pass
    boot = {
        "lieux": LIEUX,
        "types": [
            {"id": value, "label": label} for value, label in Signalement.Type.choices
        ],
        "centre": CENTRE,
        "bornes": {"sud": SUD, "ouest": OUEST, "nord": NORD, "est": EST},
    }
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
def lieux(request):
    return reponse({"lieux": LIEUX})


@protege
def signalements(request):
    if request.method == "POST":
        return creer(request)
    if request.method != "GET":
        return erreur("Méthode non prise en charge.", status=405)
    return lister(request)


def lister(request):
    items = list(base_signalements()[:100])
    appuyes = ids_appuyes(request, [item.id for item in items])
    return reponse(
        {
            "signalements": [
                signalement_public(item, item.id in appuyes) for item in items
            ],
            "tendance": tendance(items),
        }
    )


def creer(request):
    data, message = lire_json(request)
    if data is None:
        return erreur(message)
    champs = {}
    type_incident = data.get("type")
    if type_incident not in Signalement.Type.values:
        champs["type"] = (
            "Choisissez un type : bouchon, accident, travaux, police, route barrée ou autre."
        )
    commentaire = texte_propre(data.get("commentaire"))
    if len(commentaire) < 8:
        champs["commentaire"] = "Décrivez la situation en au moins 8 caractères."
    elif len(commentaire) > 280:
        champs["commentaire"] = "280 caractères maximum."
    lieu = texte_propre(data.get("lieu"))
    latitude = nombre(data.get("latitude"))
    longitude = nombre(data.get("longitude"))
    if not lieu or latitude is None or longitude is None:
        champs["lieu"] = "Indiquez un quartier connu ou un point sur la carte."
    elif not dans_libreville(latitude, longitude):
        champs["lieu"] = "Ce point est en dehors du Grand Libreville."
    elif len(lieu) > 120:
        champs["lieu"] = "Le nom du lieu est trop long."
    if champs:
        return erreur("Le signalement est incomplet.", champs=champs)

    cle = cle_session(request)
    depuis = timezone.now() - timedelta(hours=1)
    if (
        Signalement.objects.filter(session_cle=cle, cree_le__gte=depuis).count()
        >= MAX_PAR_HEURE
    ):
        return erreur(
            "Vous avez déjà publié plusieurs signalements dans l'heure. "
            "Merci de laisser de la place aux autres conducteurs.",
            status=429,
        )
    try:
        signalement = Signalement.objects.create(
            type=type_incident,
            commentaire=commentaire,
            lieu=lieu,
            latitude=latitude,
            longitude=longitude,
            session_cle=cle,
        )
    except IntegrityError:
        return erreur(
            "Ce signalement ne peut pas être enregistré.",
            champs={"lieu": "Ce point est en dehors du Grand Libreville."},
        )
    return reponse_signalement(request, signalement.pk, status=201)


@protege
@require_POST
def appui(request, pk):
    if not Signalement.objects.filter(pk=pk).exists():
        return erreur("Signalement introuvable.", status=404)
    cle = cle_session(request)
    try:
        with transaction.atomic():
            Appui.objects.create(signalement_id=pk, session_cle=cle)
    except IntegrityError:
        pass
    return reponse_signalement(request, pk)


@protege
@require_POST
def commentaire(request, pk):
    if not Signalement.objects.filter(pk=pk).exists():
        return erreur("Signalement introuvable.", status=404)
    data, message = lire_json(request)
    if data is None:
        return erreur(message)
    texte = texte_propre(data.get("texte"))
    if len(texte) < 2:
        return erreur(
            "La précision est trop courte.",
            champs={"texte": "Écrivez au moins deux caractères."},
        )
    if len(texte) > 200:
        return erreur(
            "La précision est trop longue.",
            champs={"texte": "200 caractères maximum."},
        )
    Commentaire.objects.create(signalement_id=pk, texte=texte)
    return reponse_signalement(request, pk, status=201)


def reponse_signalement(request, pk, status=200):
    try:
        item = charger(pk)
    except Signalement.DoesNotExist:
        return erreur("Signalement introuvable.", status=404)
    appuye = item.id in ids_appuyes(request, [item.id])
    return reponse({"signalement": signalement_public(item, appuye)}, status=status)
