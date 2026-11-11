from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("signalements", "0002_index_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="AbonnementPush",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("endpoint", models.URLField(max_length=512, unique=True)),
                ("cle_p256dh", models.CharField(max_length=200)),
                ("cle_auth", models.CharField(max_length=120)),
                ("session_cle", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("cree_le", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "verbose_name": "abonnement push",
                "verbose_name_plural": "abonnements push",
            },
        ),
    ]
