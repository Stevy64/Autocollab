from django.db import models


class Pilotage(models.Model):
    """Réglages uniques de la carte. Une seule ligne, lue à chaque action."""

    duree_heures = models.PositiveSmallIntegerField(default=3)
    seuil_degage = models.PositiveSmallIntegerField(default=2)
    plafond_heure = models.PositiveSmallIntegerField(default=8)
    prix_premium = models.PositiveIntegerField(default=1500)
    fond_defaut = models.CharField(max_length=16, default="satellite")
    routes_actives = models.BooleanField(default=True)
    inscriptions_ouvertes = models.BooleanField(default=True)
    lien_android = models.CharField(max_length=300, blank=True, default="")
    lien_apple = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        verbose_name = "pilotage"

    def __str__(self):
        return str(self.pk)
