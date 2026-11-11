from django.views.decorators.http import require_GET

from apps.http import reponse
from apps.signalements.push import nombre_abonnements, pret as push_pret


@require_GET
def sante(request):
    pret = push_pret()
    return reponse(
        {
            "service": "api",
            "ok": True,
            "push": pret,
            "abonnements": nombre_abonnements() if pret else 0,
        }
    )
