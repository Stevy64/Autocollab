"""Lecture des réglages. Les bornes sont la source unique, côté API."""

from .models import Pilotage

DUREE_DEFAUT = 3
SEUIL_DEFAUT = 2
PLAFOND_DEFAUT = 8

DUREE_MIN, DUREE_MAX = 1, 12
SEUIL_MIN, SEUIL_MAX = 2, 5
PLAFOND_MIN, PLAFOND_MAX = 1, 24


def _borne(valeur, bas, haut, defaut):
    try:
        n = int(valeur)
    except (TypeError, ValueError):
        return defaut
    if isinstance(valeur, bool) or n < bas or n > haut:
        return defaut
    return n


def courant():
    reglage, _cree = Pilotage.objects.get_or_create(
        pk=1,
        defaults={
            "duree_heures": DUREE_DEFAUT,
            "seuil_degage": SEUIL_DEFAUT,
            "plafond_heure": PLAFOND_DEFAUT,
        },
    )
    return reglage


def lire():
    reglage = courant()
    return {
        "duree_heures": _borne(reglage.duree_heures, DUREE_MIN, DUREE_MAX, DUREE_DEFAUT),
        "seuil_degage": _borne(reglage.seuil_degage, SEUIL_MIN, SEUIL_MAX, SEUIL_DEFAUT),
        "plafond_heure": _borne(reglage.plafond_heure, PLAFOND_MIN, PLAFOND_MAX, PLAFOND_DEFAUT),
    }
