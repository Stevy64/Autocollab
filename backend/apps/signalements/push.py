"""Web Push. Sans clés VAPID ni pywebpush, rien n'est envoyé."""

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


def nombre_abonnements():
    return AbonnementPush.objects.count()


def enregistrer(endpoint, p256dh, auth, session_cle=""):
    endpoint = (endpoint or "").strip()
    p256dh = (p256dh or "").strip()
    auth = (auth or "").strip()
    if not endpoint.startswith("https://") or not p256dh or not auth:
        return None, "Abonnement push incomplet."
    if len(endpoint) > 2048 or len(p256dh) > 200 or len(auth) > 120:
        return None, "Abonnement push trop long."
    abo, cree = AbonnementPush.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            "cle_p256dh": p256dh,
            "cle_auth": auth,
            "session_cle": (session_cle or "")[:64],
        },
    )
    return abo, "", cree


def retirer(endpoint="", session_cle=""):
    """Supprime l'abonnement Push (désactivation). Retourne le nombre d'enregistrements retirés."""
    endpoint = (endpoint or "").strip()
    session_cle = (session_cle or "").strip()[:64]
    if endpoint.startswith("https://"):
        n, _ = AbonnementPush.objects.filter(endpoint=endpoint).delete()
        return n
    if session_cle:
        n, _ = AbonnementPush.objects.filter(session_cle=session_cle).delete()
        return n
    return 0


def _payload(titre, corps, url="/", tag="wayize-push"):
    return json.dumps(
        {
            "title": titre,
            "body": corps,
            "url": url,
            "tag": tag,
        },
        ensure_ascii=False,
    )


def envoyer_a_tous(titre, corps, url="/", tag="wayize-push", signalement_id=None):
    """Envoie un Push à chaque abonnement. Journalise les échecs (410 → suppression)."""
    if not pret():
        journal("signalements", "push.skip", reason="vapid", signalement_id=signalement_id)
        return {"envoyes": 0, "echecs": 0, "expires": 0, "total": 0}
    total = AbonnementPush.objects.count()
    if total == 0:
        journal(
            "signalements",
            "push.skip",
            reason="aucun_abonnement",
            signalement_id=signalement_id,
        )
        return {"envoyes": 0, "echecs": 0, "expires": 0, "total": 0}
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        journal("signalements", "push.skip", reason="pywebpush", signalement_id=signalement_id)
        return {"envoyes": 0, "echecs": 0, "expires": 0, "total": total}

    data = _payload(titre, corps, url=url, tag=tag)
    claims = {"sub": vapid_subject()}
    privee = vapid_private()
    envoyes = 0
    echecs = 0
    expires = 0
    for abo in AbonnementPush.objects.all().iterator():
        try:
            # pywebpush courant : pas de kwarg vapid_public_key (TypeError sinon).
            webpush(
                subscription_info={
                    "endpoint": abo.endpoint,
                    "keys": {"p256dh": abo.cle_p256dh, "auth": abo.cle_auth},
                },
                data=data,
                vapid_private_key=privee,
                vapid_claims=claims,
                ttl=86400,
            )
            envoyes += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            detail = ""
            try:
                resp = getattr(exc, "response", None)
                if resp is not None and getattr(resp, "text", None):
                    detail = str(resp.text)[:160]
            except Exception:  # noqa: BLE001
                detail = ""
            if status in (404, 410):
                abo.delete()
                expires += 1
                journal(
                    "signalements",
                    "push.expired",
                    level="warning",
                    status=status,
                    abonnement_id=getattr(abo, "pk", None),
                    signalement_id=signalement_id,
                )
            else:
                echecs += 1
                journal(
                    "signalements",
                    "push.error",
                    level="warning",
                    status=status,
                    error=type(exc).__name__,
                    message=detail or str(exc)[:160],
                    signalement_id=signalement_id,
                )
        except Exception as exc:  # noqa: BLE001 — un abonné ne doit pas casser la publication
            echecs += 1
            journal(
                "signalements",
                "push.error",
                level="warning",
                error=type(exc).__name__,
                message=str(exc)[:160],
                signalement_id=signalement_id,
            )
    journal(
        "signalements",
        "push.sent" if envoyes else "push.none",
        count=envoyes,
        echecs=echecs,
        expires=expires,
        total=total,
        signalement_id=signalement_id,
    )
    return {"envoyes": envoyes, "echecs": echecs, "expires": expires, "total": total}


def notifier_signalement(signalement):
    """Prévenir les téléphones abonnés après une publication."""
    return envoyer_a_tous(
        "Wayizé",
        f"{signalement.get_type_display()} vers {signalement.lieu}",
        url=f"/#s-{signalement.pk}",
        tag=f"wayize-{signalement.pk}",
        signalement_id=signalement.pk,
    )["envoyes"]
