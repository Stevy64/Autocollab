"""Liste des quartiers : la graine de la carte, plus ceux ajoutés avec un signalement."""

import re
import unicodedata

from apps.journal import journal
from apps.signalements.geo import LIEUX, dans_libreville

from .models import Lieu


def plier(nom):
    texte = unicodedata.normalize("NFD", nom or "")
    texte = "".join(car for car in texte if unicodedata.category(car) != "Mn")
    return " ".join(texte.lower().split())


def _slug(nom, pris):
    base = re.sub(r"[^a-z0-9]+", "-", plier(nom)).strip("-")[:70] or "lieu"
    slug = base
    indice = 2
    while slug in pris:
        slug = f"{base}-{indice}"
        indice += 1
    return slug


def _public(lieu):
    return {
        "id": lieu.slug,
        "nom": lieu.nom,
        "latitude": lieu.latitude,
        "longitude": lieu.longitude,
    }


def semer():
    pris = set(Lieu.objects.values_list("slug", flat=True))
    for item in LIEUX:
        cle = plier(item["nom"])
        if Lieu.objects.filter(cle=cle).exists():
            continue
        slug = item["id"] if item["id"] not in pris else _slug(item["nom"], pris)
        Lieu.objects.create(
            slug=slug,
            nom=item["nom"],
            cle=cle,
            latitude=item["latitude"],
            longitude=item["longitude"],
        )
        pris.add(slug)


def lieux_publics():
    if not Lieu.objects.exists():
        semer()
    return [_public(lieu) for lieu in Lieu.objects.all()]


def nom_reserve(nom):
    texte = (nom or "").strip()
    return not texte or texte == "Point choisi sur la carte" or texte.startswith("Près de ")


def memoiser_lieu(nom, latitude, longitude):
    """Enregistre un quartier nouveau. Un nom déjà connu garde son point d'origine."""
    texte = " ".join((nom or "").split())
    if nom_reserve(texte) or len(texte) < 2 or len(texte) > 120:
        return None
    if not dans_libreville(latitude, longitude):
        return None
    cle = plier(texte)
    existant = Lieu.objects.filter(cle=cle).first()
    if existant:
        return _public(existant)
    pris = set(Lieu.objects.values_list("slug", flat=True))
    lieu = Lieu.objects.create(
        slug=_slug(texte, pris),
        nom=texte,
        cle=cle,
        latitude=latitude,
        longitude=longitude,
    )
    journal("lieux", "lieu.created", slug=lieu.slug, nom_len=len(texte))
    return _public(lieu)
