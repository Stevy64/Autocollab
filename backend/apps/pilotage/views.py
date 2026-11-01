"""Console d'administration. Le jeton n'est jamais journalisé."""

import re
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.appuis.models import Appui, Degage
from apps.comptes.models import Compte
from apps.comptes.secrets import correspond, email_propre
from apps.comptes.views import _compte
from apps.http import erreur, lire_json, protege, reponse, texte_propre
from apps.journal import journal, request_id
from apps.signalements.models import Signalement
from apps.signalements.present import relatif

from .reglages import (
    DUREE_MAX,
    DUREE_MIN,
    FONDS,
    PLAFOND_MAX,
    PLAFOND_MIN,
    PRIX_MAX,
    PRIX_MIN,
    SEUIL_MAX,
    SEUIL_MIN,
    courant,
    lire,
)

_JOURS = ("lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim.")
_IDENTIFIANT = re.compile(r"^[a-z0-9][a-z0-9._-]{1,39}$")
_PAGE = 40


def _page_demandee(request):
    n = _entier(request.GET.get("page"), 1, 10000)
    return n or 1


def _lien_app(valeur):
    if valeur in ("", None):
        return ""
    if not isinstance(valeur, str):
        return None
    propre = valeur.strip()[:300]
    if not propre:
        return ""
    if not propre.startswith("https://") or " " in propre:
        return None
    return propre


def _tranche(qs, page):
    total = qs.count()
    pages = max(1, (total + _PAGE - 1) // _PAGE)
    if page > pages:
        page = pages
    debut = (page - 1) * _PAGE
    return list(qs[debut : debut + _PAGE]), total, page, pages


def _compte_saisi(data):
    brut = data.get("email") if isinstance(data.get("email"), str) else ""
    if not brut and isinstance(data.get("identifiant"), str):
        brut = data.get("identifiant")
    propre = brut.strip().lower()
    if "@" in propre:
        email = email_propre(propre)
        if not email:
            return None
        return Compte.objects.filter(email=email).first()
    if _IDENTIFIANT.match(propre):
        return Compte.objects.filter(email=propre).first()
    return None


def _entier(valeur, bas, haut):
    if isinstance(valeur, bool):
        return None
    if isinstance(valeur, float) and not valeur.is_integer():
        return None
    if isinstance(valeur, str):
        propre = valeur.strip()
        if not propre.isdigit():
            return None
        valeur = propre
    try:
        n = int(valeur)
    except (TypeError, ValueError):
        return None
    if n < bas or n > haut:
        return None
    return n


def _drapeau(valeur):
    return valeur is True or valeur in (1, "1", "true", "on")


def _quand(moment):
    return timezone.localtime(moment).strftime("%d/%m/%Y · %H:%M")


def _fiche(compte):
    return {
        "id": compte.id,
        "email": compte.email,
        "pseudo": compte.pseudo or "",
        "premium": bool(compte.premium),
        "est_admin": bool(compte.est_admin),
        "confirme": compte.confirme_le is not None,
        "cree_le": compte.cree_le.isoformat(),
        "quand": _quand(compte.cree_le),
    }


def _exiger_admin(request):
    compte = _compte(request)
    if compte is None:
        return None, erreur("Connectez-vous pour continuer.", status=401)
    if not compte.est_admin:
        return None, erreur("Cet espace est réservé à l'administration.", status=403)
    return compte, None


def _semaine():
    maintenant = timezone.localtime()
    aujourd = maintenant.date()
    debut = maintenant.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)
    seaux = {}
    for cree_le in Signalement.objects.filter(cree_le__gte=debut).values_list("cree_le", flat=True):
        jour = timezone.localtime(cree_le).date()
        seaux[jour] = seaux.get(jour, 0) + 1
    jours = []
    for decalage in range(6, -1, -1):
        jour = aujourd - timedelta(days=decalage)
        jours.append(
            {
                "label": _JOURS[jour.weekday()],
                "n": seaux.get(jour, 0),
                "date": jour.isoformat(),
            }
        )
    maximum = max((jour["n"] for jour in jours), default=0) or 1
    for jour in jours:
        if jour["n"] <= 0:
            jour["pct"] = 0
        else:
            jour["pct"] = max(8, round(100 * jour["n"] / maximum))
    return jours


@protege("pilotage")
@require_http_methods(["POST"])
def entree(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    mot = data.get("mot_de_passe") if isinstance(data.get("mot_de_passe"), str) else ""
    compte = _compte_saisi(data)
    if compte is None or not correspond(mot, compte.secret, minimum=4):
        return erreur("Identifiant ou mot de passe incorrect.", status=401)
    promu = False
    with transaction.atomic():
        verrou = Compte.objects.select_for_update().get(pk=compte.pk)
        if not verrou.est_admin:
            if Compte.objects.filter(est_admin=True).exists():
                return erreur("Cet espace est réservé à l'administration.", status=403)
            verrou.est_admin = True
            verrou.save(update_fields=["est_admin"])
            promu = True
        compte = verrou
    if promu:
        journal(
            "pilotage",
            "admin.bootstrapped",
            request_id=request_id(request),
            compte_id=compte.id,
        )
    journal("pilotage", "admin.login", request_id=request_id(request), compte_id=compte.id)
    return reponse({"compte": _fiche(compte), "jeton": compte.jeton})


@protege("pilotage")
@require_http_methods(["GET"])
def apercu(request):
    _admin, refus = _exiger_admin(request)
    if refus:
        return refus
    par_type_brut = {
        row["type"]: row["n"]
        for row in Signalement.objects.values("type").annotate(n=Count("id"))
    }
    return reponse(
        {
            "signalements": Signalement.objects.count(),
            "comptes": Compte.objects.count(),
            "premium": Compte.objects.filter(premium=True).count(),
            "admins": Compte.objects.filter(est_admin=True).count(),
            "appuis": Appui.objects.count(),
            "degages": Degage.objects.count(),
            "en_retrait": Signalement.objects.filter(degages__isnull=False).distinct().count(),
            "par_type": [
                {"id": value, "label": label, "n": par_type_brut.get(value, 0)}
                for value, label in Signalement.Type.choices
            ],
            "semaine": _semaine(),
            "reglages": lire(),
        }
    )


@protege("pilotage")
@require_http_methods(["GET"])
def signalements(request):
    _admin, refus = _exiger_admin(request)
    if refus:
        return refus
    type_filtre = texte_propre(request.GET.get("type"))
    if type_filtre not in Signalement.Type.values:
        type_filtre = ""
    q = texte_propre(request.GET.get("q"))[:80]
    qs = Signalement.objects.order_by("-cree_le")
    if type_filtre:
        qs = qs.filter(type=type_filtre)
    if q:
        qs = qs.filter(Q(lieu__icontains=q) | Q(commentaire__icontains=q))
    page = _page_demandee(request)
    total = qs.count()
    pages = max(1, (total + _PAGE - 1) // _PAGE)
    if page > pages:
        page = pages
    debut = (page - 1) * _PAGE
    identifiants = list(qs.values_list("pk", flat=True)[debut : debut + _PAGE])
    par_page = (
        Signalement.objects.filter(pk__in=identifiants)
        .annotate(
            appui_count=Count("appuis", distinct=True),
            degage_count=Count("degages", distinct=True),
        )
        .order_by("-cree_le")
    )
    lignes = []
    for item in par_page:
        extrait = item.commentaire
        if len(extrait) > 140:
            extrait = extrait[:140].rstrip() + "…"
        lignes.append(
            {
                "id": item.id,
                "type": item.type,
                "type_label": item.get_type_display(),
                "lieu": item.lieu,
                "extrait": extrait,
                "appuis": item.appui_count,
                "degages": item.degage_count,
                "cree_le": item.cree_le.isoformat(),
                "quand": _quand(item.cree_le),
                "relatif": relatif(item.cree_le),
            }
        )
    return reponse(
        {
            "signalements": lignes,
            "total": total,
            "page": page,
            "pages": pages,
            "taille": _PAGE,
            "types": [{"id": value, "label": label} for value, label in Signalement.Type.choices],
            "filtre": {"type": type_filtre, "q": q},
        }
    )


@protege("pilotage")
@require_http_methods(["POST"])
def retirer(request, pk):
    admin, refus = _exiger_admin(request)
    if refus:
        return refus
    if not Signalement.objects.filter(pk=pk).exists():
        return erreur("Signalement introuvable.", status=404)
    Signalement.objects.filter(pk=pk).delete()
    journal(
        "pilotage",
        "signalement.removed",
        request_id=request_id(request),
        signalement_id=pk,
        compte_id=admin.id,
    )
    return reponse({"retire": True, "id": pk})


@protege("pilotage")
@require_http_methods(["GET"])
def comptes(request):
    _admin, refus = _exiger_admin(request)
    if refus:
        return refus
    filtre = (request.GET.get("filtre") or "").strip()
    if filtre not in ("abonnes", "admins", "attente"):
        filtre = ""
    q = " ".join((request.GET.get("q") or "").split())[:80]
    qs = Compte.objects.order_by("-cree_le")
    if filtre == "abonnes":
        qs = qs.filter(premium=True)
    elif filtre == "admins":
        qs = qs.filter(est_admin=True)
    elif filtre == "attente":
        qs = qs.filter(confirme_le__isnull=True)
    if q:
        qs = qs.filter(Q(email__icontains=q) | Q(pseudo__icontains=q))
    extraits, total, page, pages = _tranche(qs, _page_demandee(request))
    return reponse(
        {
            "comptes": [_fiche(compte) for compte in extraits],
            "total": total,
            "page": page,
            "pages": pages,
            "taille": _PAGE,
            "admins": Compte.objects.filter(est_admin=True).count(),
            "abonnes": Compte.objects.filter(premium=True).count(),
            "attente": Compte.objects.filter(confirme_le__isnull=True).count(),
            "filtre": filtre,
            "q": q,
        }
    )


@protege("pilotage")
@require_http_methods(["POST"])
def compte_modifier(request, pk):
    admin, refus = _exiger_admin(request)
    if refus:
        return refus
    cible = Compte.objects.filter(pk=pk).first()
    if cible is None:
        return erreur("Compte introuvable.", status=404)
    data, message = lire_json(request)
    if message:
        return erreur(message)
    champs = []
    if "premium" in data:
        cible.premium = _drapeau(data.get("premium"))
        champs.append("premium")
    if "est_admin" in data:
        veut = _drapeau(data.get("est_admin"))
        if cible.est_admin and not veut:
            if not Compte.objects.filter(est_admin=True).exclude(pk=cible.pk).exists():
                return erreur("Il doit rester au moins un administrateur.", status=400)
        cible.est_admin = veut
        champs.append("est_admin")
    if champs:
        cible.save(update_fields=champs)
    journal(
        "pilotage",
        "compte.updated",
        request_id=request_id(request),
        compte_id=cible.id,
        par=admin.id,
        premium=bool(cible.premium),
        est_admin=bool(cible.est_admin),
    )
    return reponse({"compte": _fiche(cible)})


@protege("pilotage")
@require_http_methods(["GET", "POST"])
def reglages(request):
    admin, refus = _exiger_admin(request)
    if refus:
        return refus
    if request.method == "GET":
        return reponse(lire())
    data, message = lire_json(request)
    if message:
        return erreur(message)
    duree = _entier(data.get("duree_heures"), DUREE_MIN, DUREE_MAX)
    seuil = _entier(data.get("seuil_degage"), SEUIL_MIN, SEUIL_MAX)
    plafond = _entier(data.get("plafond_heure"), PLAFOND_MIN, PLAFOND_MAX)
    champs = {}
    if duree is None:
        champs["duree_heures"] = f"Entre {DUREE_MIN} et {DUREE_MAX} heures."
    if seuil is None:
        champs["seuil_degage"] = f"Entre {SEUIL_MIN} et {SEUIL_MAX} votes."
    if plafond is None:
        champs["plafond_heure"] = f"Entre {PLAFOND_MIN} et {PLAFOND_MAX} signalements."
    reglage = courant()
    suivi = ["duree_heures", "seuil_degage", "plafond_heure"]
    if "prix_premium" in data:
        prix = _entier(data.get("prix_premium"), PRIX_MIN, PRIX_MAX)
        if prix is None:
            champs["prix_premium"] = f"Entre {PRIX_MIN} et {PRIX_MAX} F."
        else:
            reglage.prix_premium = prix
            suivi.append("prix_premium")
    if "fond_defaut" in data:
        fond = data.get("fond_defaut")
        if fond not in FONDS:
            champs["fond_defaut"] = "Choisissez Satellite ou Routes."
        else:
            reglage.fond_defaut = fond
            suivi.append("fond_defaut")
    if "routes_actives" in data:
        reglage.routes_actives = _drapeau(data.get("routes_actives"))
        suivi.append("routes_actives")
    if "inscriptions_ouvertes" in data:
        reglage.inscriptions_ouvertes = _drapeau(data.get("inscriptions_ouvertes"))
        suivi.append("inscriptions_ouvertes")
    for cle in ("lien_android", "lien_apple"):
        if cle not in data:
            continue
        lien = _lien_app(data.get(cle))
        if lien is None:
            champs[cle] = "Indiquez une adresse https, ou laissez vide."
        else:
            setattr(reglage, cle, lien)
            suivi.append(cle)
    if champs:
        return erreur("Ces réglages ne sont pas valables.", champs=champs)
    if not reglage.routes_actives and reglage.fond_defaut == "routes":
        reglage.fond_defaut = "satellite"
        if "fond_defaut" not in suivi:
            suivi.append("fond_defaut")
    reglage.duree_heures = duree
    reglage.seuil_degage = seuil
    reglage.plafond_heure = plafond
    reglage.save(update_fields=suivi)
    journal(
        "pilotage",
        "reglages.updated",
        request_id=request_id(request),
        compte_id=admin.id,
        duree_heures=duree,
        seuil_degage=seuil,
        plafond_heure=plafond,
        prix_premium=reglage.prix_premium,
        fond_defaut=reglage.fond_defaut,
        routes_actives=bool(reglage.routes_actives),
        inscriptions_ouvertes=bool(reglage.inscriptions_ouvertes),
    )
    return reponse(lire())
