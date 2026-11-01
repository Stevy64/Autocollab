from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("commentaires", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="commentaire",
            name="auteur",
            field=models.CharField(default="Un usager", max_length=24),
        ),
    ]
