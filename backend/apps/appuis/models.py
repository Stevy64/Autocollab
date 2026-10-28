from django.db import models
from django.utils import timezone

from apps.signalements.models import Signalement


class Appui(models.Model):
    signalement = models.ForeignKey(
        Signalement,
        on_delete=models.CASCADE,
        related_name="appuis",
    )
    session_cle = models.CharField(max_length=64)
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "appui"
        verbose_name_plural = "appuis"
        constraints = [
            models.UniqueConstraint(
                fields=["signalement", "session_cle"],
                name="appui_une_fois_par_session",
            )
        ]

    def __str__(self):
        return f"Appui #{self.pk} sur {self.signalement_id}"
