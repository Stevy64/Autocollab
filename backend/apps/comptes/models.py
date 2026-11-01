from django.db import models


class Compte(models.Model):
    email = models.EmailField(unique=True)
    secret = models.CharField(max_length=160)
    jeton = models.CharField(max_length=64, unique=True)
    premium = models.BooleanField(default=False)
    est_admin = models.BooleanField(default=False)
    pseudo = models.CharField(max_length=24, blank=True, default="")
    pseudo_cle = models.CharField(max_length=24, null=True, unique=True, blank=True)
    confirme_le = models.DateTimeField(null=True, blank=True)
    domicile_id = models.CharField(max_length=80, blank=True, default="")
    travail_id = models.CharField(max_length=80, blank=True, default="")
    anonyme = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "compte"
        indexes = [
            models.Index(fields=["premium", "cree_le"], name="compte_premium_cree"),
            models.Index(fields=["est_admin", "cree_le"], name="compte_admin_cree"),
            models.Index(fields=["confirme_le"], name="compte_confirme"),
        ]

    def __str__(self):
        return str(self.pk)


class Liste(models.Model):
    compte = models.ForeignKey(Compte, related_name="listes", on_delete=models.CASCADE)
    nom = models.CharField(max_length=40)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "liste"
        ordering = ["id"]


class JetonCourriel(models.Model):
    """Lien à usage unique pour confirmer l'adresse ou choisir un nouveau mot de passe."""

    CONFIRMATION = "confirmation"
    REINITIALISATION = "reinitialisation"
    GENRES = (
        (CONFIRMATION, "confirmation"),
        (REINITIALISATION, "reinitialisation"),
    )

    compte = models.ForeignKey(Compte, related_name="courriels", on_delete=models.CASCADE)
    genre = models.CharField(max_length=20, choices=GENRES)
    empreinte = models.CharField(max_length=64, unique=True)
    expire_le = models.DateTimeField()
    utilise_le = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "jeton courriel"


class Suivi(models.Model):
    liste = models.ForeignKey(Liste, related_name="suivis", on_delete=models.CASCADE)
    lieu_id = models.CharField(max_length=48)

    class Meta:
        verbose_name = "suivi"
        constraints = [
            models.UniqueConstraint(fields=("liste", "lieu_id"), name="suivi_lieu_une_fois"),
        ]
