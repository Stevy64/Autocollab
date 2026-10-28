def presenter(compte):
    listes = []
    for liste in compte.listes.all().prefetch_related("suivis"):
        listes.append(
            {
                "id": liste.id,
                "nom": liste.nom,
                "lieux": [suivi.lieu_id for suivi in liste.suivis.all()],
            }
        )
    return {
        "email": compte.email,
        "premium": compte.premium,
        "est_admin": compte.est_admin,
        "listes": listes,
    }
