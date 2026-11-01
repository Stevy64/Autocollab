"""Lecture des réglages. Les bornes sont la source unique, côté API."""

from .models import Pilotage

DUREE_DEFAUT = 3
SEUIL_DEFAUT = 2
PLAFOND_DEFAUT = 8
PRIX_DEFAUT = 1500
FOND_DEFAUT = "satellite"

DUREE_MIN, DUREE_MAX = 1, 12
SEUIL_MIN, SEUIL_MAX = 2, 5
PLAFOND_MIN, PLAFOND_MAX = 1, 24
PRIX_MIN, PRIX_MAX = 0, 100000
FONDS = ("satellite", "routes")


def _borne(valeur, bas, haut, defaut):
    try:
        n = int(valeur)
    except (TypeError, ValueError):
        return defaut
    if isinstance(valeur, bool) or n < bas or n > haut:
        return defaut
    return n


def _fond(valeur):
    if valeur in FONDS:
        return valeur
    return FOND_DEFAUT


def courant():
    reglage, _cree = Pilotage.objects.get_or_create(
        pk=1,
        defaults={
            "duree_heures": DUREE_DEFAUT,
            "seuil_degage": SEUIL_DEFAUT,
            "plafond_heure": PLAFOND_DEFAUT,
            "prix_premium": PRIX_DEFAUT,
            "fond_defaut": FOND_DEFAUT,
            "routes_actives": True,
            "inscriptions_ouvertes": True,
        },
    )
    return reglage


def lire():
    reglage = courant()
    routes = bool(reglage.routes_actives)
    fond = _fond(reglage.fond_defaut)
    if not routes:
        fond = FOND_DEFAUT
    return {
        "duree_heures": _borne(reglage.duree_heures, DUREE_MIN, DUREE_MAX, DUREE_DEFAUT),
        "seuil_degage": _borne(reglage.seuil_degage, SEUIL_MIN, SEUIL_MAX, SEUIL_DEFAUT),
        "plafond_heure": _borne(reglage.plafond_heure, PLAFOND_MIN, PLAFOND_MAX, PLAFOND_DEFAUT),
        "prix_premium": _borne(reglage.prix_premium, PRIX_MIN, PRIX_MAX, PRIX_DEFAUT),
        "fond_defaut": fond,
        "routes_actives": routes,
        "inscriptions_ouvertes": bool(reglage.inscriptions_ouvertes),
        "lien_android": _lien(reglage.lien_android),
        "lien_apple": _lien(reglage.lien_apple),
    }


def _lien(valeur):
    if not isinstance(valeur, str):
        return ""
    propre = valeur.strip()[:300]
    if propre.startswith("https://") and " " not in propre:
        return propre
    return ""


def publics():
    """Ce que la carte peut afficher, sans les plafonds internes."""
    lu = lire()
    return {
        "prix_premium": lu["prix_premium"],
        "fond_defaut": lu["fond_defaut"],
        "routes_actives": lu["routes_actives"],
        "lien_android": lu["lien_android"],
        "lien_apple": lu["lien_apple"],
    }
