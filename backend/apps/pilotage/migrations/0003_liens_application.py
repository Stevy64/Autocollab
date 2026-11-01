from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pilotage", "0002_parametres_site"),
    ]

    operations = [
        migrations.AddField(
            model_name="pilotage",
            name="lien_android",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="pilotage",
            name="lien_apple",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
