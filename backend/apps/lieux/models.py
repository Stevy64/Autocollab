from django.db import models
from django.utils import timezone


class Lieu(models.Model):
    """Quartier connu. La liste de départ est celle de la carte ; les signalements l'agrandissent."""

    slug = models.SlugField(max_length=80, unique=True)
    nom = models.CharField(max_length=120)
    cle = models.CharField(max_length=120, unique=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["nom"]
        verbose_name = "lieu"
        verbose_name_plural = "lieux"

    def __str__(self):
        return self.nom
