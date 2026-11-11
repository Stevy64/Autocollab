from django.views.decorators.http import require_http_methods

from apps.http import erreur, lire_json, protege, reponse
from apps.identite import cle_session
from apps.journal import journal, request_id

from .push import enregistrer, vapid_public


@protege("signalements")
@require_http_methods(["POST"])
def abonnement(request):
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
