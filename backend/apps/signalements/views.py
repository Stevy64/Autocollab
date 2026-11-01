from datetime import timedelta

from django.db import IntegrityError
from django.db.models import Count, Prefetch
from django.utils import timezone
from django.views.decorators.http import require_GET

from apps.commentaires.models import Commentaire
from apps.http import erreur, lire_json, nombre, protege, reponse, texte_propre
from apps.identite import cle_session
from apps.journal import journal, request_id

from apps.pilotage.reglages import lire, publics

from apps.lieux.catalogue import lieux_publics, memoiser_lieu

from .geo import CENTRE, EST, NORD, OUEST, SUD, dans_libreville
from .models import Signalement
from .present import signalement_public, tendance


def purger_expires():
    """Une alerte vit le nombre d'heures réglé, puis elle quitte la base."""
    seuil = timezone.now() - timedelta(hours=lire()["duree_heures"])
    anciens = Signalement.objects.filter(cree_le__lte=seuil)
    nombre_retires = anciens.count()
    if not nombre_retires:
        return 0
    anciens.delete()
    journal(
        "signalements",
        "signalement.expired",
        count=nombre_retires,
    )
    return nombre_retires


def base_signalements():
    return (
        Signalement.objects.annotate(
            appui_count=Count("appuis", distinct=True),
            degage_count=Count("degages", distinct=True),
        )
        .prefetch_related(
            Prefetch(
                "commentaires",
                queryset=Commentaire.objects.order_by("-cree_le"),
                to_attr="notes_recentes",
            )
        )
        .order_by("-cree_le")
    )


def ids_appuyes(cle, identifiants):
    if not cle or not identifiants:
        return set()
    from apps.appuis.models import Appui

    return set(
        Appui.objects.filter(session_cle=cle, signalement_id__in=identifiants).values_list(
            "signalement_id",
            flat=True,
        )
    )


def ids_degages(cle, identifiants):
    if not cle or not identifiants:
        return set()
    from apps.appuis.models import Degage

    return set(
        Degage.objects.filter(session_cle=cle, signalement_id__in=identifiants).values_list(
            "signalement_id",
            flat=True,
        )
    )


def charger(pk):
    return base_signalements().get(pk=pk)


def reponse_signalement(request, pk, status=200, lieu=None):
    try:
        item = charger(pk)
    except Signalement.DoesNotExist:
        return erreur("Signalement introuvable.", status=404)
    cle = cle_session(request)
    appuye = item.id in ids_appuyes(cle, [item.id])
    degage = item.id in ids_degages(cle, [item.id])
    corps = {"signalement": signalement_public(item, appuye, degage)}
    if lieu:
        corps["lieu"] = lieu
    return reponse(corps, status=status)


@require_GET
def carte(request):
    liste = lieux_publics()
    journal(
        "signalements",
        "carte.read",
        request_id=request_id(request),
        lieux=len(liste),
    )
    return reponse(
        {
            "lieux": liste,
            "types": [
                {"id": value, "label": label} for value, label in Signalement.Type.choices
            ],
            "centre": CENTRE,
            "bornes": {"sud": SUD, "ouest": OUEST, "nord": NORD, "est": EST},
            "reglages": publics(),
        }
    )


@protege("signalements")
def signalements(request):
    if request.method == "POST":
        return creer(request)
    if request.method != "GET":
        return erreur("Méthode non prise en charge.", status=405)
    return lister(request)


def lister(request):
    purger_expires()
    # La carte publique reste bornée : l'admin pagine le reste.
    items = list(base_signalements()[:100])
    cle = cle_session(request)
    identifiants = [item.id for item in items]
    appuyes = ids_appuyes(cle, identifiants)
    degages = ids_degages(cle, identifiants)
    reglage = lire()
    return reponse(
        {
            "signalements": [
                signalement_public(item, item.id in appuyes, item.id in degages)
                for item in items
            ],
            "tendance": tendance(items, heures=reglage["duree_heures"]),
            "duree_heures": reglage["duree_heures"],
            "seuil_degage": reglage["seuil_degage"],
        }
    )


def creer(request):
    data, message = lire_json(request)
    if data is None:
        journal(
            "signalements",
            "signalement.rejected",
            level="warning",
            request_id=request_id(request),
            status=400,
        )
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
        champs["lieu"] = "Indiquez le quartier et un point dans le Grand Libreville."
    elif not dans_libreville(latitude, longitude):
        champs["lieu"] = "Ce point est en dehors du Grand Libreville."
    elif len(lieu) > 120:
        champs["lieu"] = "Le nom du lieu est trop long."
    if champs:
        journal(
            "signalements",
            "signalement.rejected",
            level="warning",
            request_id=request_id(request),
            status=400,
            champs=sorted(champs),
        )
        return erreur("Le signalement est incomplet.", champs=champs)

    cle = cle_session(request)
    if not cle:
        journal(
            "signalements",
            "signalement.rejected",
            level="warning",
            request_id=request_id(request),
            status=400,
            raison="identite",
        )
        return erreur("Ouvrez Wayizé dans le navigateur pour publier un signalement.")

    depuis = timezone.now() - timedelta(hours=1)
    if (
        Signalement.objects.filter(session_cle=cle, cree_le__gte=depuis).count()
        >= lire()["plafond_heure"]
    ):
        journal(
            "signalements",
            "signalement.rate_limited",
            level="warning",
            request_id=request_id(request),
            status=429,
        )
        return erreur(
            "Vous avez déjà publié plusieurs signalements dans l'heure. "
            "Merci de laisser de la place aux autres usagers.",
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
        journal(
            "signalements",
            "signalement.rejected",
            level="warning",
            request_id=request_id(request),
            status=400,
            champs=["lieu"],
        )
        return erreur(
            "Ce signalement ne peut pas être enregistré.",
            champs={"lieu": "Ce point est en dehors du Grand Libreville."},
        )
    journal(
        "signalements",
        "signalement.created",
        request_id=request_id(request),
        signalement_id=signalement.pk,
        type=signalement.type,
        lieu=signalement.lieu,
        commentaire_len=len(commentaire),
    )
    lieu_enregistre = memoiser_lieu(signalement.lieu, signalement.latitude, signalement.longitude)
    return reponse_signalement(request, signalement.pk, status=201, lieu=lieu_enregistre)
