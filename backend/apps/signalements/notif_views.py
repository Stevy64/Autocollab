from django.views.decorators.http import require_GET, require_http_methods

from apps.http import erreur, lire_json, protege, reponse
from apps.identite import cle_session
from apps.journal import journal, request_id

from .push import enregistrer, pret, vapid_public


@require_GET
def etat(request):
    """État public du Push. Pas de clé privée."""
    publique = vapid_public()
    return reponse(
        {
            "push": pret(),
            "vapid_public": publique or None,
        }
    )


@protege("signalements")
@require_http_methods(["POST"])
def abonnement(request):
    if not pret():
        return erreur(
            "Les notifications téléphone ne sont pas configurées sur ce serveur "
            "(clés VAPID absentes).",
            status=503,
        )
    data, message = lire_json(request)
    if data is None:
        return erreur(message)
    endpoint = data.get("endpoint")
    keys = data.get("keys") if isinstance(data.get("keys"), dict) else {}
    abo, probleme = enregistrer(
        endpoint,
        keys.get("p256dh"),
        keys.get("auth"),
        cle_session(request),
    )
    if probleme:
        return erreur(probleme, status=400)
    journal(
        "signalements",
        "push.subscribed",
        request_id=request_id(request),
        abonnement_id=abo.pk,
    )
    return reponse({"ok": True, "vapid_public": vapid_public() or None})
