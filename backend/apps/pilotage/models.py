from django.db import models


class Pilotage(models.Model):
    """Réglages uniques de la carte. Une seule ligne, lue à chaque action."""

    duree_heures = models.PositiveSmallIntegerField(default=3)
    seuil_degage = models.PositiveSmallIntegerField(default=2)
    plafond_heure = models.PositiveSmallIntegerField(default=8)

    class Meta:
        verbose_name = "pilotage"

    def __str__(self):
        return str(self.pk)
