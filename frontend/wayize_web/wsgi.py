import os

from django.core.wsgi import get_wsgi_application

# Défaut : développement. En production, poser DJANGO_SETTINGS_MODULE=wayize_web.prod
# avant le démarrage de gunicorn (setdefault ne l'écrase pas).
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wayize_web.settings")
application = get_wsgi_application()
