from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("comptes", "0003_courriel_et_profil"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="compte",
            index=models.Index(fields=["premium", "cree_le"], name="compte_premium_cree"),
        ),
        migrations.AddIndex(
            model_name="compte",
            index=models.Index(fields=["est_admin", "cree_le"], name="compte_admin_cree"),
        ),
        migrations.AddIndex(
            model_name="compte",
            index=models.Index(fields=["confirme_le"], name="compte_confirme"),
        ),
    ]
