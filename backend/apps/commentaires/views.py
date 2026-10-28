from django.views.decorators.http import require_POST

from apps.http import erreur, lire_json, protege, texte_propre
from apps.journal import journal, request_id
from apps.signalements.models import Signalement
from apps.signalements.views import reponse_signalement

from .models import Commentaire


@protege("commentaires")
@require_POST
def commentaire(request, pk):
    if not Signalement.objects.filter(pk=pk).exists():
        journal(
            "commentaires",
            "boundary.read",
            level="warning",
            request_id=request_id(request),
            target="signalements",
            signalement_id=pk,
            found=False,
        )
        return erreur("Signalement introuvable.", status=404)
    journal(
        "commentaires",
        "boundary.read",
        request_id=request_id(request),
        target="signalements",
        signalement_id=pk,
        found=True,
    )
    data, message = lire_json(request)
    if data is None:
        journal(
            "commentaires",
            "commentaire.rejected",
            level="warning",
            request_id=request_id(request),
            signalement_id=pk,
            status=400,
        )
        return erreur(message)
    texte = texte_propre(data.get("texte"))
    if len(texte) < 2:
        journal(
            "commentaires",
            "commentaire.rejected",
            level="warning",
            request_id=request_id(request),
            signalement_id=pk,
            status=400,
            champs=["texte"],
        )
        return erreur(
            "La précision est trop courte.",
            champs={"texte": "Écrivez au moins deux caractères."},
        )
    if len(texte) > 200:
        journal(
            "commentaires",
            "commentaire.rejected",
            level="warning",
            request_id=request_id(request),
            signalement_id=pk,
            status=400,
            champs=["texte"],
        )
        return erreur(
            "La précision est trop longue.",
            champs={"texte": "200 caractères maximum."},
        )
    note = Commentaire.objects.create(signalement_id=pk, texte=texte)
    journal(
        "commentaires",
        "commentaire.created",
        request_id=request_id(request),
        signalement_id=pk,
        commentaire_id=note.pk,
        longueur=len(texte),
    )
    return reponse_signalement(request, pk, status=201)
