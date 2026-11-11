"""Lecture des réglages. Les bornes sont la source unique, côté API."""

import base64
import hashlib

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
TAILLE_LOGO = 600_000


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
        "logo": _logo_url(reglage),
    }


def _lien(valeur):
    if not isinstance(valeur, str):
        return ""
    propre = valeur.strip()[:300]
    if propre.startswith("https://") and " " not in propre:
        return propre
    return ""


def _type_image(brut):
    if brut.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if brut.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(brut) >= 12 and brut.startswith(b"RIFF") and brut[8:12] == b"WEBP":
        return "image/webp"
    return ""


def decoder_logo(valeur):
    """Une chaîne vide retire le logo. Le reste est une image en base64."""
    if valeur == "":
        return {"ok": True, "vide": True}
    if not isinstance(valeur, str) or not valeur.strip():
        return {"ok": False, "message": "Le logo envoyé n'est pas reconnu."}
    try:
        brut = base64.b64decode(valeur, validate=True)
    except (ValueError, TypeError):
        return {"ok": False, "message": "Le logo envoyé n'est pas reconnu."}
    if not brut or len(brut) > TAILLE_LOGO:
        return {"ok": False, "message": "Le logo doit rester sous 600 Ko."}
    type_image = _type_image(brut)
    if not type_image:
        return {"ok": False, "message": "Le logo doit être une image PNG, JPEG ou WebP."}
    return {"ok": True, "vide": False, "octets": brut, "type": type_image}


def _logo_url(reglage):
    brut = bytes(reglage.logo) if reglage.logo else b""
    if not brut or not _type_image(brut):
        return ""
    empreinte = hashlib.sha256(brut).hexdigest()[:12]
    return f"/api/logo/?v={empreinte}"


def publics():
    """Ce que la carte peut afficher, sans les plafonds internes."""
    import os

    lu = lire()
    vapid = os.environ.get("WAYIZE_VAPID_PUBLIC_KEY", "").strip()
    corps = {
        "prix_premium": lu["prix_premium"],
        "fond_defaut": lu["fond_defaut"],
        "routes_actives": lu["routes_actives"],
        "lien_android": lu["lien_android"],
        "lien_apple": lu["lien_apple"],
        "logo": lu["logo"],
    }
    if vapid:
        corps["vapid_public"] = vapid
    return corps