from django.db import migrations, models
import django.utils.timezone


def semer_lieux(apps, schema_editor):
    from apps.lieux.catalogue import semer

    semer()


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Lieu",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("nom", models.CharField(max_length=120)),
                ("cle", models.CharField(max_length=120, unique=True)),
                ("latitude", models.FloatField()),
                ("longitude", models.FloatField()),
                ("cree_le", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "verbose_name": "lieu",
                "verbose_name_plural": "lieux",
                "ordering": ["nom"],
            },
        ),
        migrations.RunPython(semer_lieux, migrations.RunPython.noop),
    ]
