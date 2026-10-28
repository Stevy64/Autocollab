from django.db import models


class Compte(models.Model):
    email = models.EmailField(unique=True)
    secret = models.CharField(max_length=160)
    jeton = models.CharField(max_length=64, unique=True)
    premium = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "compte"

    def __str__(self):
        return str(self.pk)


class Liste(models.Model):
    compte = models.ForeignKey(Compte, related_name="listes", on_delete=models.CASCADE)
    nom = models.CharField(max_length=40)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "liste"
        ordering = ["id"]


class Suivi(models.Model):
    liste = models.ForeignKey(Liste, related_name="suivis", on_delete=models.CASCADE)
    lieu_id = models.CharField(max_length=48)

    class Meta:
        verbose_name = "suivi"
        constraints = [
            models.UniqueConstraint(fields=("liste", "lieu_id"), name="suivi_lieu_une_fois"),
        ]
