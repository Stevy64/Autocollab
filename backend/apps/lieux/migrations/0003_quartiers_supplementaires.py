from django.db import migrations


def semer_lieux(apps, schema_editor):
    from apps.lieux.catalogue import semer

    semer()


class Migration(migrations.Migration):

    dependencies = [
        ("lieux", "0002_points_kilometriques"),
    ]

    operations = [
        migrations.RunPython(semer_lieux, migrations.RunPython.noop),
    ]
