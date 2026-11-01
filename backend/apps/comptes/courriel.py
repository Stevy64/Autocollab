"""Liens envoyés par email. Le jeton en clair n'est pas stocké."""

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.journal import journal

from .models import JetonCourriel

_DUREES = {
    JetonCourriel.CONFIRMATION: timedelta(hours=24),
    JetonCourriel.REINITIALISATION: timedelta(hours=2),
}


def _empreinte(clair):
    return hashlib.sha256(clair.encode("utf-8")).hexdigest()


def emettre(compte, genre):
    JetonCourriel.objects.filter(compte=compte, genre=genre, utilise_le__isnull=True).update(
        utilise_le=timezone.now()
    )
    clair = secrets.token_urlsafe(32)
    JetonCourriel.objects.create(
        compte=compte,
        genre=genre,
        empreinte=_empreinte(clair),
        expire_le=timezone.now() + _DUREES[genre],
    )
    return clair


def consommer(genre, clair):
    if not isinstance(clair, str) or not 20 <= len(clair) <= 80:
        return None
    ligne = (
        JetonCourriel.objects.select_related("compte")
        .filter(genre=genre, empreinte=_empreinte(clair), utilise_le__isnull=True)
        .first()
    )
    if ligne is None or ligne.expire_le <= timezone.now():
        return None
    ligne.utilise_le = timezone.now()
    ligne.save(update_fields=["utilise_le"])
    return ligne.compte


def _origine():
    return getattr(settings, "WAYIZE_PUBLIC_URL", "http://127.0.0.1:8647").rstrip("/")


def lien(genre, clair):
    cle = "confirmer" if genre == JetonCourriel.CONFIRMATION else "reinitialiser"
    return f"{_origine()}/?{cle}={clair}"


def envoyer(compte, genre, request_id=""):
    clair = emettre(compte, genre)
    url = lien(genre, clair)
    if genre == JetonCourriel.CONFIRMATION:
        sujet = "Confirmez votre compte Wayizé"
        corps = (
            "Bonjour,\n\n"
            "Confirmez votre adresse pour ouvrir votre compte Wayizé :\n"
            f"{url}\n\n"
            "Ce lien expire dans 24 heures.\n"
        )
    else:
        sujet = "Choisissez un nouveau mot de passe Wayizé"
        corps = (
            "Bonjour,\n\n"
            "Choisissez un nouveau mot de passe pour votre compte Wayizé :\n"
            f"{url}\n\n"
            "Ce lien expire dans 2 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n"
        )
    try:
        send_mail(sujet, corps, settings.DEFAULT_FROM_EMAIL, [compte.email], fail_silently=False)
    except Exception as exc:
        journal(
            "comptes",
            "courriel.failed",
            level="warning",
            request_id=request_id,
            compte_id=compte.id,
            error=type(exc).__name__,
        )
    return url
