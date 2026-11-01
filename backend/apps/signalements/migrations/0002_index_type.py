from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("signalements", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="signalement",
            index=models.Index(fields=["type", "cree_le"], name="signalement_type_cree"),
        ),
    ]
