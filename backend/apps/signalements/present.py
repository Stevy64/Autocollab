from datetime import timedelta

from django.utils import timezone

TYPES_CHAUDS = {"bouchon", "accident", "route_barree"}


def relatif(moment, maintenant=None):
    maintenant = maintenant or timezone.now()
    secondes = int((maintenant - moment).total_seconds())
    if secondes < 45:
        return "à l'instant"
    minutes = secondes // 60
    if minutes < 60:
        return f"il y a {minutes} min"
    heures = minutes // 60
    if heures < 24:
        if heures == 1:
            return "il y a 1 h"
        return f"il y a {heures} h"
    jours = heures // 24
    if jours == 1:
        return "il y a 1 jour"
    return f"il y a {jours} jours"


def tendance(signalements, maintenant=None, heures=3):
    """Résumé lisible des dernières heures, sans suivi GPS."""
    maintenant = maintenant or timezone.now()
    try:
        fenetre = int(heures)
    except (TypeError, ValueError):
        fenetre = 3
    if fenetre < 1:
        fenetre = 3
    seuil = maintenant - timedelta(hours=fenetre)
    recents = [item for item in signalements if item.cree_le >= seuil]
    chauds = sorted(
        (item for item in recents if item.type in TYPES_CHAUDS),
        key=lambda item: item.cree_le,
        reverse=True,
    )
    lieux = []
    for item in chauds:
        if item.lieu not in lieux:
            lieux.append(item.lieu)
        if len(lieux) == 2:
            break

    if chauds:
        focus = chauds[0].pk
    elif recents:
        focus = recents[0].pk
    elif signalements:
        focus = signalements[0].pk
    else:
        focus = None

    if len(chauds) >= 3:
        niveau = "dense"
        titre = "Circulation dense"
        if len(lieux) >= 2:
            detail = (
                f"{len(chauds)} incidents notables, surtout vers {lieux[0]} et {lieux[1]}."
            )
        elif lieux:
            detail = f"{len(chauds)} incidents notables, surtout vers {lieux[0]}."
        else:
            detail = "Plusieurs incidents ralentissent les grands axes."
    elif chauds:
        niveau = "ralentie"
        titre = "Quelques ralentissements"
        detail = f"Ça se concentre vers {lieux[0]}."
    elif any(item.type == "travaux" for item in recents):
        niveau = "ralentie"
        titre = "Quelques ralentissements"
        chantier = next(item for item in recents if item.type == "travaux")
        detail = f"Des travaux ralentissent la circulation vers {chantier.lieu}."
        focus = chantier.pk
    else:
        niveau = "fluide"
        titre = "Circulation fluide"
        detail = "Peu d'alertes sur les axes de Libreville ces dernières heures."

    return {
        "niveau": niveau,
        "titre": titre,
        "detail": detail,
        "focus_id": focus,
    }


def commentaire_public(commentaire):
    return {
        "id": commentaire.id,
        "texte": commentaire.texte,
        "relatif": relatif(commentaire.cree_le),
        "cree_le": commentaire.cree_le.isoformat(),
    }


def signalement_public(signalement, appuye, degage=False):
    notes = getattr(signalement, "notes_recentes", None)
    if notes is None:
        notes = list(signalement.commentaires.all()[:30])
    else:
        notes = list(notes[:30])
    appuis = getattr(signalement, "appui_count", None)
    if appuis is None:
        appuis = signalement.appuis.count()
    degages = getattr(signalement, "degage_count", None)
    if degages is None:
        degages = signalement.degages.count()
    return {
        "id": signalement.id,
        "type": signalement.type,
        "type_label": signalement.get_type_display(),
        "commentaire": signalement.commentaire,
        "lieu": signalement.lieu,
        "latitude": signalement.latitude,
        "longitude": signalement.longitude,
        "appuis": appuis,
        "appuye": appuye,
        "degages": degages,
        "degage": degage,
        "commentaires": [commentaire_public(note) for note in notes],
        "cree_le": signalement.cree_le.isoformat(),
        "relatif": relatif(signalement.cree_le),
    }
