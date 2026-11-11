"""Web Push optionnel. Sans clés VAPID ni pywebpush, rien n'est envoyé."""

from __future__ import annotations

import json
import os

from apps.journal import journal

from .models import AbonnementPush


def vapid_public():
    return os.environ.get("WAYIZE_VAPID_PUBLIC_KEY", "").strip()


def vapid_private():
    return os.environ.get("WAYIZE_VAPID_PRIVATE_KEY", "").strip()


def vapid_subject():
    sujet = os.environ.get("WAYIZE_VAPID_SUBJECT", "").strip()
    return sujet or "mailto:dev@wayize.local"


def pret():
    return bool(vapid_public() and vapid_private())


def enregistrer(endpoint, p256dh, auth, session_cle=""):
    endpoint = (endpoint or "").strip()
    p256dh = (p256dh or "").strip()
    auth = (auth or "").strip()
    if not endpoint.startswith("https://") or not p256dh or not auth:
        return None, "Abonnement push incomplet."
    if len(endpoint) > 2048 or len(p256dh) > 200 or len(auth) > 120:
        return None, "Abonnement push trop long."
    abo, _cree = AbonnementPush.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            "cle_p256dh": p256dh,
            "cle_auth": auth,
            "session_cle": (session_cle or "")[:64],
        },
    )
    return abo, ""


def notifier_signalement(signalement):
    """Prévenir les téléphones abonnés. Échec silencieux si Push n'est pas configuré."""
    if not pret():
        return 0
    if not AbonnementPush.objects.exists():
        return 0
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        journal("signalements", "push.skip", reason="pywebpush")
        return 0

    titre = "Wayizé"
    corps = f"{signalement.get_type_display()} vers {signalement.lieu}"
    payload = json.dumps(
        {
            "title": titre,
            "body": corps,
            "url": f"/#s-{signalement.pk}",
            "tag": f"wayize-{signalement.pk}",
        },
        ensure_ascii=False,
    )
    claims = {"sub": vapid_subject()}
    privee = vapid_private()
    publique = vapid_public()
    envoyes = 0
    for abo in AbonnementPush.objects.all().iterator():
        try:
            # pywebpush accepte la clé URL-safe ; on passe aussi la publique si dispo.
            kwargs = {
                "subscription_info": {
                    "endpoint": abo.endpoint,
                    "keys": {"p256dh": abo.cle_p256dh, "auth": abo.cle_auth},
                },
                "data": payload,
                "vapid_private_key": privee,
                "vapid_claims": claims,
                "ttl": 120,
            }
            if publique:
                kwargs["vapid_public_key"] = publique
            webpush(**kwargs)
            envoyes += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                abo.delete()
            else:
                journal(
                    "signalements",
                    "push.error",
                    level="warning",
                    status=status,
                    error=type(exc).__name__,
                )
        except Exception as exc:  # noqa: BLE001 — un abonné ne doit pas casser la publication
            journal(
                "signalements",
                "push.error",
                level="warning",
                error=type(exc).__name__,
                message=str(exc)[:120],
            )
    if envoyes:
        journal("signalements", "push.sent", count=envoyes, signalement_id=signalement.pk)
    return envoyes
