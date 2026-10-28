from django.apps import AppConfig


class TraficConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "trafic"
    verbose_name = "Trafic"

    def ready(self):
        from django.db.models.signals import post_migrate

        def _seed(sender, **kwargs):
            if getattr(sender, "label", None) != "trafic":
                return
            from .seed import ensure_seed

            ensure_seed()

        post_migrate.connect(_seed, dispatch_uid="trafic.ensure_seed")
