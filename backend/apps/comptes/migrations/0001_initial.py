from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Compte",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("secret", models.CharField(max_length=160)),
                ("jeton", models.CharField(max_length=64, unique=True)),
                ("premium", models.BooleanField(default=False)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name": "compte"},
        ),
        migrations.CreateModel(
            name="Liste",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nom", models.CharField(max_length=40)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
                (
                    "compte",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="listes",
                        to="comptes.compte",
                    ),
                ),
            ],
            options={"verbose_name": "liste", "ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="Suivi",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("lieu_id", models.CharField(max_length=48)),
                (
                    "liste",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="suivis",
                        to="comptes.liste",
                    ),
                ),
            ],
            options={
                "verbose_name": "suivi",
                "constraints": [
                    models.UniqueConstraint(fields=("liste", "lieu_id"), name="suivi_lieu_une_fois"),
                ],
            },
        ),
    ]
