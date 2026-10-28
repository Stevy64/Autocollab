from django.db import IntegrityError, transaction
from django.views.decorators.http import require_POST

from apps.http import erreur, protege
from apps.identite import cle_session
from apps.journal import journal, request_id
from apps.signalements.models import Signalement
from apps.signalements.views import reponse_signalement

from .models import Appui


@protege("appuis")
@require_POST
def appui(request, pk):
    if not Signalement.objects.filter(pk=pk).exists():
        journal(
            "appuis",
            "boundary.read",
            level="warning",
            request_id=request_id(request),
            target="signalements",
            signalement_id=pk,
            found=False,
        )
        return erreur("Signalement introuvable.", status=404)
    journal(
        "appuis",
        "boundary.read",
        request_id=request_id(request),
        target="signalements",
        signalement_id=pk,
        found=True,
    )
    cle = cle_session(request)
    if not cle:
        journal(
            "appuis",
            "appui.rejected",
            level="warning",
            request_id=request_id(request),
            signalement_id=pk,
            status=400,
            raison="identite",
        )
        return erreur("Ouvrez Wayizé dans le navigateur pour appuyer ce signalement.")
    nouveau = True
    try:
        with transaction.atomic():
            Appui.objects.create(signalement_id=pk, session_cle=cle)
    except IntegrityError:
        nouveau = False
    journal(
        "appuis",
        "appui.recorded",
        request_id=request_id(request),
        signalement_id=pk,
        nouveau=nouveau,
    )
    return reponse_signalement(request, pk)
