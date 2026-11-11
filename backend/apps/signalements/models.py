from django.db import models
from django.db.models import Q
from django.utils import timezone

from .geo import EST, NORD, OUEST, SUD


class Signalement(models.Model):
    class Type(models.TextChoices):
        BOUCHON = "bouchon", "Bouchon"
        ACCIDENT = "accident", "Accident"
        TRAVAUX = "travaux", "Travaux"
        POLICE = "police", "Police"
        ROUTE_BARREE = "route_barree", "Route barrée"
        AUTRE = "autre", "Autre"

    type = models.CharField("type", max_length=20, choices=Type.choices)
    commentaire = models.CharField("commentaire", max_length=280)
    lieu = models.CharField("lieu", max_length=120)
    latitude = models.FloatField("latitude")
    longitude = models.FloatField("longitude")
    session_cle = models.CharField(max_length=64, blank=True, default="")
    cree_le = models.DateTimeField("créé le", default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "signalement"
        verbose_name_plural = "signalements"
        indexes = [
            models.Index(fields=["type", "cree_le"], name="signalement_type_cree"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(latitude__gte=SUD, latitude__lte=NORD)
                & Q(longitude__gte=OUEST, longitude__lte=EST),
                name="signalement_dans_libreville",
            )
        ]

    def __str__(self):
        return f"{self.get_type_display()} · {self.lieu}"


class AbonnementPush(models.Model):
    """Abonnement Web Push du navigateur. La clé privée VAPID reste dans l'environnement."""

    endpoint = models.URLField(max_length=512, unique=True)
    cle_p256dh = models.CharField(max_length=200)
    cle_auth = models.CharField(max_length=120)
    session_cle = models.CharField(max_length=64, blank=True, default="", db_index=True)
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "abonnement push"
        verbose_name_plural = "abonnements push"

    def __str__(self):
        return self.endpoint[:64]
