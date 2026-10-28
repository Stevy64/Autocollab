from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.appuis.models import Appui
from apps.commentaires.models import Commentaire

from .geo import lieu_par_id
from .models import Signalement

GRAINE_CLE = "graine"

# minutes : âge du signalement. notes : (âge en minutes, texte), plus récent que le signalement.
GRAINE = [
    {
        "type": "bouchon",
        "lieu_id": "nzeng-ayong",
        "minutes": 11,
        "appuis": 8,
        "commentaire": (
            "Sortie des classes à Nzeng-Ayong. La voie vers le centre est chargée "
            "jusqu'au carrefour, comptez un bon quart d'heure."
        ),
        "notes": [
            (6, "Je suis dans la file, ça avance au pas depuis le carrefour."),
        ],
    },
    {
        "type": "bouchon",
        "lieu_id": "mont-bouet",
        "minutes": 22,
        "appuis": 17,
        "commentaire": (
            "Le marché déborde sur la chaussée. Deux files presque à l'arrêt "
            "en direction du centre."
        ),
        "notes": [
            (14, "Je confirme, à l'arrêt depuis le feu du marché."),
            (9, "Par Louis, la descente vers Glass est plus fluide."),
        ],
    },
    {
        "type": "police",
        "lieu_id": "aeroport",
        "minutes": 36,
        "appuis": 5,
        "commentaire": (
            "Contrôle sur le boulevard Georges Rawiri, à l'approche de l'aéroport. "
            "Ralentissement léger, gardez les pièces du véhicule à portée."
        ),
        "notes": [
            (20, "Contrôle assez rapide si les papiers sont prêts."),
        ],
    },
    {
        "type": "accident",
        "lieu_id": "echangeur-iai",
        "minutes": 50,
        "appuis": 23,
        "commentaire": (
            "Collision légère sur la bretelle vers Lalala. La voie de gauche est prise, "
            "la droite passe au pas."
        ),
        "notes": [
            (40, "La bretelle vers Lalala est la plus touchée."),
            (28, "Mettez les warnings, on débouche sans visibilité."),
            (18, "Une voie vient d'être rouverte, encore au ralenti."),
        ],
    },
    {
        "type": "police",
        "lieu_id": "batterie-iv",
        "minutes": 75,
        "appuis": 3,
        "commentaire": (
            "Présence policière près du carrefour de Batterie IV. "
            "Contrôles ponctuels, la voie n'est pas fermée."
        ),
        "notes": [],
    },
    {
        "type": "autre",
        "lieu_id": "glass",
        "minutes": 100,
        "appuis": 6,
        "commentaire": (
            "Flaques après l'averse sur le bas de Glass. "
            "La chaussée glisse, roulez au pas dans les creux."
        ),
        "notes": [
            (70, "Oui, ça glisse. Je suis passé tout doucement devant le bord de mer."),
        ],
    },
    {
        "type": "bouchon",
        "lieu_id": "pk5",
        "minutes": 130,
        "appuis": 11,
        "commentaire": (
            "Ralentissement entre le PK5 et Nkembo. "
            "Ça se dégage un peu après le rond-point, dans le sens du centre."
        ),
        "notes": [
            (90, "Ça coince surtout dans le sens du centre vers le PK8."),
        ],
    },
    {
        "type": "travaux",
        "lieu_id": "pk8",
        "minutes": 145,
        "appuis": 7,
        "commentaire": (
            "Tranchée sur l'avenue au PK8. Circulation alternée, "
            "prévoyez une dizaine de minutes de plus vers Nzeng-Ayong."
        ),
        "notes": [
            (120, "Les agents laissent passer par paquets. Ça circule, mais lentement."),
        ],
    },
    {
        "type": "travaux",
        "lieu_id": "oloumi",
        "minutes": 160,
        "appuis": 4,
        "commentaire": (
            "Reprise de chaussée à Oloumi. Une voie est neutralisée "
            "en direction du centre-ville."
        ),
        "notes": [],
    },
    {
        "type": "route_barree",
        "lieu_id": "port-owendo",
        "minutes": 170,
        "appuis": 15,
        "commentaire": (
            "L'accès poids lourds du port d'Owendo est fermé. "
            "Les voitures passent par la déviation d'Owendo centre."
        ),
        "notes": [
            (150, "Les taxis passent par Owendo centre. Le quai reste fermé aux gros camions."),
            (110, "Toujours le cas, j'ai fait demi-tour avant le port."),
        ],
    },
]


def ensure_seed(force=False):
    if force:
        Signalement.objects.filter(session_cle=GRAINE_CLE).delete()
    elif Signalement.objects.exists():
        return 0
    if Signalement.objects.filter(session_cle=GRAINE_CLE).exists():
        return 0
    with transaction.atomic():
        _creer()
    return len(GRAINE)


def _creer():
    maintenant = timezone.now()
    for item in GRAINE:
        lieu = lieu_par_id(item["lieu_id"])
        signalement = Signalement.objects.create(
            type=item["type"],
            commentaire=item["commentaire"],
            lieu=lieu["nom"],
            latitude=lieu["latitude"],
            longitude=lieu["longitude"],
            session_cle=GRAINE_CLE,
            cree_le=maintenant - timedelta(minutes=item["minutes"]),
        )
        Appui.objects.bulk_create(
            [
                Appui(
                    signalement=signalement,
                    session_cle=f"graine-{signalement.pk}-{index}",
                    cree_le=signalement.cree_le,
                )
                for index in range(item["appuis"])
            ]
        )
        Commentaire.objects.bulk_create(
            [
                Commentaire(
                    signalement=signalement,
                    texte=texte,
                    cree_le=maintenant - timedelta(minutes=minutes),
                )
                for minutes, texte in item["notes"]
            ]
        )
