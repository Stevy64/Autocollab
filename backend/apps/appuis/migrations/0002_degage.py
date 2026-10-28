import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("appuis", "0001_initial"),
        ("signalements", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Degage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_cle", models.CharField(max_length=64)),
                ("cree_le", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "signalement",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="degages",
                        to="signalements.signalement",
                    ),
                ),
            ],
            options={
                "verbose_name": "dégagé",
                "verbose_name_plural": "dégagés",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("signalement", "session_cle"),
                        name="degage_une_fois_par_session",
                    )
                ],
            },
        ),
    ]
