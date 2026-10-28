from django.db import IntegrityError, transaction
from django.views.decorators.http import require_POST

from apps.http import erreur, protege, reponse
from apps.identite import cle_session
from apps.journal import journal, request_id
from apps.signalements.models import Signalement
from apps.signalements.views import purger_expires, reponse_signalement

from .models import Appui, Degage

SEUIL_DEGAGE = 2


@protege("appuis")
@require_POST
def appui(request, pk):
    purger_expires()
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
    deja = Appui.objects.filter(signalement_id=pk, session_cle=cle).first()
    if deja:
        deja.delete()
        journal(
            "appuis",
            "appui.removed",
            request_id=request_id(request),
            signalement_id=pk,
        )
        return reponse_signalement(request, pk)
    try:
        with transaction.atomic():
            Appui.objects.create(signalement_id=pk, session_cle=cle)
    except IntegrityError:
        pass
    journal(
        "appuis",
        "appui.recorded",
        request_id=request_id(request),
        signalement_id=pk,
        nouveau=True,
    )
    return reponse_signalement(request, pk)


@protege("appuis")
@require_POST
def degage(request, pk):
    """Un usager dit que la situation n'est plus là. Deux voix retirent l'alerte."""
    purger_expires()
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
            "degage.rejected",
            level="warning",
            request_id=request_id(request),
            signalement_id=pk,
            status=400,
            raison="identite",
        )
        return erreur("Ouvrez Wayizé dans le navigateur pour dire que c'est dégagé.")
    deja = Degage.objects.filter(signalement_id=pk, session_cle=cle).first()
    if deja:
        deja.delete()
        journal(
            "appuis",
            "degage.removed",
            request_id=request_id(request),
            signalement_id=pk,
        )
        return reponse_signalement(request, pk)
    try:
        with transaction.atomic():
            Degage.objects.create(signalement_id=pk, session_cle=cle)
    except IntegrityError:
        pass
    journal(
        "appuis",
        "degage.recorded",
        request_id=request_id(request),
        signalement_id=pk,
        nouveau=True,
    )
    if Degage.objects.filter(signalement_id=pk).count() >= SEUIL_DEGAGE:
        Signalement.objects.filter(pk=pk).delete()
        journal(
            "appuis",
            "signalement.cleared",
            request_id=request_id(request),
            signalement_id=pk,
        )
        return reponse({"retire": True, "id": pk})
    return reponse_signalement(request, pk)
