from django.views.decorators.http import require_GET

from apps.http import reponse


@require_GET
def sante(request):
    return reponse({"service": "api", "ok": True})
