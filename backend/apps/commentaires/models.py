from django.db import models
from django.utils import timezone

from apps.signalements.models import Signalement


class Commentaire(models.Model):
    signalement = models.ForeignKey(
        Signalement,
        on_delete=models.CASCADE,
        related_name="commentaires",
    )
    texte = models.CharField(max_length=200)
    cree_le = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "commentaire"
        verbose_name_plural = "commentaires"

    def __str__(self):
        return self.texte[:48]
