from django.db import migrations, models
from django.utils import timezone


def confirmer_comptes_existants(apps, schema_editor):
    Compte = apps.get_model("comptes", "Compte")
    Compte.objects.filter(confirme_le__isnull=True).update(confirme_le=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ("comptes", "0002_est_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="compte",
            name="anonyme",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="compte",
            name="confirme_le",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="compte",
            name="domicile_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="compte",
            name="pseudo",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
        migrations.AddField(
            model_name="compte",
            name="pseudo_cle",
            field=models.CharField(blank=True, max_length=24, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="compte",
            name="travail_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.CreateModel(
            name="JetonCourriel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("genre", models.CharField(choices=[("confirmation", "confirmation"), ("reinitialisation", "reinitialisation")], max_length=20)),
                ("empreinte", models.CharField(max_length=64, unique=True)),
                ("expire_le", models.DateTimeField()),
                ("utilise_le", models.DateTimeField(blank=True, null=True)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
                ("compte", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="courriels", to="comptes.compte")),
            ],
            options={"verbose_name": "jeton courriel"},
        ),
        migrations.RunPython(confirmer_comptes_existants, migrations.RunPython.noop),
    ]
