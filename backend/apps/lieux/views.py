from django.views.decorators.http import require_GET

from apps.http import reponse
from apps.journal import journal, request_id
from apps.lieux.catalogue import lieux_publics


@require_GET
def lieux(request):
    liste = lieux_publics()
    journal(
        "lieux",
        "lieux.listed",
        request_id=request_id(request),
        count=len(liste),
    )
    return reponse({"lieux": liste})
