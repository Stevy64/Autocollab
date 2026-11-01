from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pilotage", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pilotage",
            name="fond_defaut",
            field=models.CharField(default="satellite", max_length=16),
        ),
        migrations.AddField(
            model_name="pilotage",
            name="inscriptions_ouvertes",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="pilotage",
            name="prix_premium",
            field=models.PositiveIntegerField(default=1500),
        ),
        migrations.AddField(
            model_name="pilotage",
            name="routes_actives",
            field=models.BooleanField(default=True),
        ),
    ]
