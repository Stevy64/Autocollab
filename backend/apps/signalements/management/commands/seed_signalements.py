from django.core.management.base import BaseCommand

from apps.signalements.seed import ensure_seed


class Command(BaseCommand):
    help = "Ajoute des signalements d'exemple à Libreville si la base est vide."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Remplace les signalements d'exemple déjà présents.",
        )

    def handle(self, *args, **options):
        created = ensure_seed(force=options["force"])
        if created:
            self.stdout.write(
                self.style.SUCCESS(f"{created} signalements d'exemple ajoutés.")
            )
        else:
            self.stdout.write(
                "Des signalements existent déjà. "
                "Rien à faire (utilisez --force pour régénérer les exemples)."
            )
