from django.views.decorators.http import require_GET, require_http_methods

from apps.comptes.views import _compte
from apps.http import erreur, lire_json, protege, reponse
from apps.identite import cle_session
from apps.journal import journal, request_id

from .models import AbonnementPush
from .push import (
    enregistrer,
    envoyer_a_tous,
    nombre_abonnements,
    pret,
    retirer,
    vapid_public,
)


@require_GET
def etat(request):
    """État public du Push. Pas de clé privée. Inclut le nombre d'abonnements."""
    publique = vapid_public()
    return reponse(
        {
            "push": pret(),
            "vapid_public": publique or None,
            "abonnements": nombre_abonnements() if pret() else 0,
        }
    )


@protege("signalements")
@require_http_methods(["POST", "DELETE"])
def abonnement(request):
    """Active ou coupe le Push anonyme. Session X-Wayize-Session suffit (pas de compte)."""
    if not pret():
        return erreur(
            "Les notifications téléphone ne sont pas configurées sur ce serveur "
            "(clés VAPID absentes).",
            status=503,
        )
    data, message = lire_json(request)
    if data is None:
        return erreur(message)
    if not isinstance(data, dict):
        data = {}

    actif = data.get("actif", True)
    if request.method == "DELETE" or actif is False or str(actif).lower() in ("0", "false", "off"):
        endpoint = data.get("endpoint") or ""
        session = cle_session(request)
        n = retirer(endpoint, session)
        journal(
            "signalements",
            "push.unsubscribed",
            request_id=request_id(request),
            retires=n,
            abonnements=nombre_abonnements(),
        )
        return reponse({"ok": True, "actif": False, "retires": n, "abonnements": nombre_abonnements()})

    endpoint = data.get("endpoint")
    keys = data.get("keys") if isinstance(data.get("keys"), dict) else {}
    abo, probleme, cree = enregistrer(
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
        cree=bool(cree),
        abonnements=nombre_abonnements(),
    )
    return reponse(
        {
            "ok": True,
            "actif": True,
            "vapid_public": vapid_public() or None,
            "abonnements": nombre_abonnements(),
            "cree": bool(cree),
        }
    )


def _exiger_admin(request):
    compte = _compte(request)
    if compte is None:
        return None, erreur("Connectez-vous pour continuer.", status=401)
    if not compte.est_admin:
        return None, erreur("Réservé à l'administration.", status=403)
    return compte, None


@protege("signalements")
@require_GET
def admin_liste(request):
    """Nombre d'abonnements + aperçu des endpoints (admin)."""
    compte, refuse = _exiger_admin(request)
    if refuse:
        return refuse
    items = list(
        AbonnementPush.objects.order_by("-cree_le").values(
            "id", "endpoint", "session_cle", "cree_le"
        )[:50]
    )
    for item in items:
        ep = item.get("endpoint") or ""
        item["endpoint"] = (ep[:48] + "…") if len(ep) > 48 else ep
        item["cree_le"] = item["cree_le"].isoformat() if item.get("cree_le") else ""
        item["session_cle"] = (item.get("session_cle") or "")[:8]
    return reponse(
        {
            "push": pret(),
            "abonnements": nombre_abonnements(),
            "items": items,
        }
    )


@protege("signalements")
@require_http_methods(["POST"])
def admin_test(request):
    """Envoie un Push de test à tous les abonnés (admin)."""
    compte, refuse = _exiger_admin(request)
    if refuse:
        return refuse
    if not pret():
        return erreur("Clés VAPID absentes.", status=503)
    if nombre_abonnements() == 0:
        return erreur(
            "Aucun téléphone abonné. Sur le téléphone : ouvrir la carte, "
            "activer les notifications (sans compte).",
            status=400,
        )
    data, _message = lire_json(request)
    if not isinstance(data, dict):
        data = {}
    titre = (data.get("titre") or "Wayizé").strip()[:80] or "Wayizé"
    corps = (data.get("corps") or "Test de notification téléphone.").strip()[:200]
    if not corps:
        corps = "Test de notification téléphone."
    resultat = envoyer_a_tous(titre, corps, url="/", tag="wayize-test")
    journal(
        "signalements",
        "push.test",
        request_id=request_id(request),
        admin_id=compte.pk,
        **resultat,
    )
    return reponse({"ok": True, **resultat})
