from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Pilotage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("duree_heures", models.PositiveSmallIntegerField(default=3)),
                ("seuil_degage", models.PositiveSmallIntegerField(default=2)),
                ("plafond_heure", models.PositiveSmallIntegerField(default=8)),
            ],
            options={"verbose_name": "pilotage"},
        ),
    ]
