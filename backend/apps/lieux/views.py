from django.views.decorators.http import require_GET

from apps.http import reponse
from apps.journal import journal, request_id
from apps.signalements.geo import LIEUX


@require_GET
def lieux(request):
    journal(
        "lieux",
        "lieux.listed",
        request_id=request_id(request),
        count=len(LIEUX),
    )
    return reponse({"lieux": LIEUX})
