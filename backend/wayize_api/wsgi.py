import os

from django.core.wsgi import get_wsgi_application

# Défaut : développement. En production, poser DJANGO_SETTINGS_MODULE=wayize_api.prod
# avant le démarrage de gunicorn (setdefault ne l'écrase pas).
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wayize_api.settings")
application = get_wsgi_application()
