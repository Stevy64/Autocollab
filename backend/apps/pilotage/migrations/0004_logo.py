from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pilotage", "0003_liens_application"),
    ]

    operations = [
        migrations.AddField(
            model_name="pilotage",
            name="logo",
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pilotage",
            name="logo_type",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
