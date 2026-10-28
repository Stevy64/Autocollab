from django.apps import AppConfig


class SignalementsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.signalements"
    label = "signalements"
    verbose_name = "Signalements"

    def ready(self):
        from django.db.models.signals import post_migrate

        def _seed(sender, **kwargs):
            from django.db import connection
            from django.db.utils import OperationalError, ProgrammingError

            try:
                tables = set(connection.introspection.table_names())
            except (OperationalError, ProgrammingError):
                return
            requis = {
                "signalements_signalement",
                "appuis_appui",
                "commentaires_commentaire",
            }
            if not requis <= tables:
                return
            from .seed import ensure_seed

            ensure_seed()

        post_migrate.connect(_seed, dispatch_uid="wayize.ensure_seed")
