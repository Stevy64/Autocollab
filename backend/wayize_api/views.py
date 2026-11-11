from django.views.decorators.http import require_GET

from apps.http import reponse
from apps.signalements.push import pret as push_pret


@require_GET
def sante(request):
    return reponse({"service": "api", "ok": True, "push": push_pret()})
