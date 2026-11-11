from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("signalements", "0003_abonnementpush"),
    ]

    operations = [
        migrations.AlterField(
            model_name="abonnementpush",
            name="endpoint",
            field=models.URLField(max_length=2048, unique=True),
        ),
    ]
